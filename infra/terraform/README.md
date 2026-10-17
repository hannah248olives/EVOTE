# Evote infrastructure (Terraform)

Infrastructure as code for Evote on AWS. **Nothing here is created by clicking in the AWS
console** — every resource comes from `terraform apply`.

## Layout

```
infra/terraform/
├── bootstrap/        one-time: S3 bucket for remote state (local state, run once per account)
├── modules/
│   ├── network/      VPC, public/private subnets across 2 AZs, locked-down default SG
│   ├── database/     Aurora PostgreSQL 16 Serverless v2 (encrypted, managed master password)
│   └── cache/        ElastiCache Redis (TLS + AUTH token in Secrets Manager)
└── envs/
    └── dev/          composes the modules; one root per environment
```

Future environments (`staging`, `prod` — EVT-503) are new roots under `envs/` that reuse the same
modules with different inputs.

## What `envs/dev` creates (EVT-002)

| Resource | Notes | Approx. cost |
| --- | --- | --- |
| VPC + 2 public / 2 private subnets | No NAT gateway, no public IPs | free |
| Aurora PostgreSQL 16, Serverless v2, 1 instance (`enable_database`) | 0 to 1 ACU with auto-pause, 1-day backups, encrypted | compute only while in use; idle: storage and one secret (cents per month) |
| ElastiCache Redis, 1 x `cache.t4g.micro` (`enable_cache`, off by default) | TLS in transit, encrypted at rest, AUTH token. It cannot pause | about USD 12 / month if left on, about USD 0.02 per hour |
| Secrets Manager secrets | DB master credentials (with the database), Redis AUTH token (with the cache) | about USD 0.40 each per month |

Prices are approximate and depend on the region; check the AWS pricing pages and your own bill.

### Cost modes

Choose one in `envs/dev/terraform.tfvars` (a git-ignored copy of `terraform.tfvars.example`):

| Mode | Settings | Cost |
| --- | --- | --- |
| **Network only** | `enable_database = false`, `enable_cache = false` | USD 0. 15 resources, none billed |
| **Least cost** | `enable_database = true`, `enable_cache = false`, `database_min_acu = 0` | Pennies when idle; compute is billed only while the database is being used |
| **Full** | both `true` | Redis is billed per hour until destroyed |

Least cost notes:

- With `database_min_acu = 0` the cluster **pauses itself after 5 idle minutes**. The first
  connection after a pause takes several seconds, so clients must retry.
- Open connections (a connection pool, a running dev server) keep it awake and billing. Stop them
  when you are done.
- Redis cannot pause. Development uses the local Docker Redis; create the ElastiCache group only for
  an integration test and destroy it afterwards (`enable_cache = false`, then `apply`).
- Production must use `database_min_acu = 0.5` or higher so it never pauses.
- A budget alert warns about spend but does not stop it; AWS credits can also expire.

## Outputs

`terraform output` returns the DB and Redis URLs. **They never contain credentials.** Fetch the
password / token from the Secrets Manager ARN in the matching output and inject it at runtime.

| Output | Example |
| --- | --- |
| `database_url` | `postgres://evote_admin@evote-dev.cluster-xxxx.eu-north-1.rds.amazonaws.com:5432/evote` |
| `redis_url` | `rediss://master.evote-dev.xxxx.eun1.cache.amazonaws.com:6379` |
| `database_master_secret_arn` / `redis_auth_token_secret_arn` | Secrets Manager ARNs |

## Prerequisites

- Terraform `>= 1.11` (CI uses 1.16.6)
- AWS CLI v2, authenticated to the **dev** account (`aws sts get-caller-identity` to confirm)
- Never put access keys in files in this repo. Use `aws configure sso` or short-lived credentials.

## First-time setup

```bash
# 1. Create the remote-state bucket (once per AWS account, local state)
cd infra/terraform/bootstrap
terraform init
terraform apply

# 2. Point the dev environment at that bucket
cd ../envs/dev
cp backend.hcl.example backend.hcl        # edit bucket/region; backend.hcl is git-ignored
terraform init -backend-config=backend.hcl

# 3. Review, then apply
terraform plan -out=tfplan
terraform apply tfplan
```

## Development does not wait for AWS

Nothing in Sprints 0 to 4 needs this AWS environment. Day-to-day development runs on the local
Docker stack (Postgres and Redis, EVT-005), so no ticket is blocked by AWS access, cost or account
ownership. AWS is first needed for a shared staging environment and for production (Sprint 5).

## Handing over to the team's AWS account

The code is account-independent: no account IDs, no credentials and no region are hard-coded
(the region is the `aws_region` variable and the state bucket name is derived from the account ID).
Whoever owns the team account configures cost and sizing through variables, not by editing code:

| Decision | Where | Default |
| --- | --- | --- |
| Create the database | `enable_database` | `true` (the sandbox sets `false`) |
| Create the cache | `enable_cache` | `false` (turn on for integration tests or production) |
| Database capacity | `database_min_acu` / `database_max_acu` | `0` (auto-pause) / `1`; production: `0.5` or more |
| Cache node size and count | `cache_node_type` (module `node_count`) | `cache.t4g.micro` / `1` |
| NAT gateway (egress) | `enable_nat_gateway` | `false` |
| Region | `aws_region` | `eu-north-1` |

Steps to move to the team account:

1. Create or choose the account; give each member their own limited identity (no root user, MFA on
   root). Set a budget alert.
2. In the old sandbox: `terraform destroy` (the network-only stack is free and removes cleanly).
3. In the new account run `bootstrap/` once to create the state bucket.
4. In `envs/dev`: delete any local `backend_override.tf` and `terraform.tfstate`, create
   `backend.hcl` from the example, then `terraform init -backend-config=backend.hcl`.
5. Review `terraform.tfvars` (start from `terraform.tfvars.example`), then `plan` and `apply`.

If the sandbox must be kept instead of destroyed, move its state with
`terraform init -migrate-state -backend-config=backend.hcl`.

## Everyday workflow

1. Change code on a `feat/evt-<n>-<slug>` branch.
2. `terraform fmt -recursive && terraform validate` locally.
3. Open a PR; CI runs `fmt` and `validate` for every root. **Paste the `terraform plan` summary in
   the PR description** — reviewers approve plans, not just code.
4. Apply only from `main` after merge, and only by an infra owner.

## Rules

- State, `*.tfvars`, `backend.hcl` and plan files are git-ignored. Never force-add them.
- `.terraform.lock.hcl` **is** committed (provider versions are pinned and reviewed).
- No secrets in variables, outputs or code. Use Secrets Manager.
- Every resource is tagged via provider `default_tags`; do not hand-tag.
- `deletion_protection = true` and `skip_final_snapshot = false` are mandatory outside dev.
- Security groups reference other security groups, never `0.0.0.0/0` ingress.

## Known caveats and decisions

- **Redis version.** Charter v5.0 names Redis 7.2, but ElastiCache for Redis OSS tops out at 7.1.
  Dev uses 7.1. 7.2 exists on ElastiCache only as Valkey (`engine = "valkey"`), which is
  wire-compatible and cheaper; BullMQ works with it. Decide before production.
- **Region.** Dev defaults to `eu-north-1` (Stockholm), where the dev account lives; Aurora
  PostgreSQL 16 (Serverless v2) and ElastiCache Redis 7.1 were confirmed available there.
  `af-south-1` is closer to users but is opt-in and must be enabled per account; revisit for
  production.
- **PostgreSQL version.** AWS's default Aurora PostgreSQL version is now 17.x, but the charter
  specifies 16. The database module therefore picks the first available entry of
  `preferred_engine_versions` (16.15 down to 16.8) instead of the AWS default.
- **Not included yet** (follow-up tickets): VPC flow logs, WAF, EKS, the CI role for OIDC-based
  applies (no long-lived AWS keys in GitHub), IaC security scanning.
