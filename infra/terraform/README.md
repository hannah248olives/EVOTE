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
| VPC + 2 public / 2 private subnets | No NAT gateway by default | free |
| Aurora PostgreSQL 16, Serverless v2, 1 instance | 0.5–2 ACU, 7-day backups, encrypted | ~USD 45–90 / month |
| ElastiCache Redis, 1 × `cache.t4g.micro` | TLS in transit, encrypted at rest, AUTH token | ~USD 12 / month |
| Secrets Manager (2 secrets) | DB master credentials, Redis AUTH token | ~USD 1 / month |

Estimated dev total: **about USD 60–110 / month** while running. `terraform destroy` removes it all.

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
- **Cost knob.** Setting `database_min_acu = 0` enables Aurora auto-pause in dev (requires a
  supported engine minor). Default stays `0.5` so the environment is always available.
- **Not included yet** (follow-up tickets): VPC flow logs, WAF, EKS, the CI role for OIDC-based
  applies (no long-lived AWS keys in GitHub), IaC security scanning.
