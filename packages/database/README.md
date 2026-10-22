# @evote/database

PostgreSQL schema and migrations for Evote, using [Drizzle ORM](https://orm.drizzle.team). This is
the single source of truth for the data model (Charter section 10).

## What is here (EVT-101)

| Table        | Purpose                                | Charter |
| ------------ | -------------------------------------- | ------- |
| `tenants`    | A school (subdomain, branding)         | 10.1    |
| `users`      | Admins and teachers of one school      | 10.2    |
| `positions`  | Elected roles such as Head Prefect     | 10.4    |
| `candidates` | Students standing for a position       | 10.4    |

Tenant isolation with Row-Level Security (EVT-104) is described [below](#tenant-isolation-row-level-security).

Not here yet: `authorized_kiosks` (EVT-201), `votes`, `vote_aggregates` and `audit_log`
(Sprint 2), branding fields beyond the tenant columns (EVT-401).

## Tenant isolation (Row-Level Security)

A school must never see another school's data, even if application code forgets a filter. The
database enforces it (migration `0001_rls_tenant_isolation.sql`):

- Every tenant table has RLS **enabled and forced**, with one `tenant_isolation` policy that
  compares the row's school with `app_tenant_id()`.
- `app_tenant_id()` reads the setting `app.tenant_id`. If it is missing or empty, the result is
  `NULL`, no row matches, and the query returns nothing. **No tenant means no data.**
- The API connects as **`evote_app`**, a role that owns nothing and has no DDL rights. Superusers and
  table owners bypass RLS, so the API must never connect as them. Migrations run as the owner.

Use the helpers, never raw `SET`:

```ts
import { createDatabase, withTenant, resolveTenantBySubdomain } from "@evote/database";

const { db } = createDatabase(process.env.DATABASE_URL!); // connects as evote_app

// 1. Before a tenant is known (subdomain middleware, EVT-106):
const tenantId = await resolveTenantBySubdomain(db, "stmarys"); // null if unknown or inactive

// 2. Everything else runs inside withTenant. The id comes from the verified subdomain or token.
const rows = await withTenant(db, tenantId, (tx) => tx.select().from(positions));
```

`withTenant` validates that the id is a UUID, opens a transaction, and sets the tenant with
`set_config(..., true)` so it is local to that transaction and cannot leak to the next request on a
pooled connection.

**Creating a school** (signup, EVT-102): generate the id first, set it as the tenant, then insert the
tenant row with that same id. The policy rejects any other combination.

**Subdomain lookup:** `resolveTenantBySubdomain` calls `resolve_tenant_by_subdomain()`, a
`SECURITY DEFINER` function owned by `evote_lookup`, a role that can read only `id`, `subdomain` and
`is_active` of active schools. The `tenants` table itself stays closed.

### Giving `evote_app` a login (once per environment)

The migration creates `evote_app` and `evote_lookup` without a login. Provision the API login outside
the repository, with a password from your secret store, and never commit it:

```sql
ALTER ROLE evote_app LOGIN PASSWORD '<from your secrets>';
```

### Adding a tenant table

Every new table with a `tenant_id` needs, in its migration: `ENABLE ROW LEVEL SECURITY`,
`FORCE ROW LEVEL SECURITY`, a `tenant_isolation` policy, and a `GRANT` to `evote_app`. The test
`enables AND forces RLS on ... every table that has a tenant_id` fails the build if one is missing.

### Known limits

- Platform operators (`super_admin`) have no school; how they cross schools is not designed yet.
- The `SECURITY DEFINER` function changes owner to `evote_lookup`. This needs a migration role that
  is allowed to do that (a superuser locally). Verify it on the managed database before production.

## Commands

Run from the repository root, with Postgres from `docker compose up postgres`.

```bash
# Create or change the schema, then generate a migration (never edit applied migrations)
pnpm --filter @evote/database db:generate --name <what_changed>

# Apply all pending migrations to the database in DATABASE_URL
DATABASE_URL=postgres://evote:<password>@localhost:5432/evote pnpm --filter @evote/database db:migrate

# Check that the migration history is consistent
pnpm --filter @evote/database db:check

# Type-check, and run the tests against a real PostgreSQL
pnpm --filter @evote/database typecheck
TEST_DATABASE_URL=postgres://evote:<password>@localhost:5432/postgres pnpm --filter @evote/database test
```

The tests create a temporary database, migrate it, and drop it afterwards, so they never touch your
`evote` database. They need a user that may create databases (the compose user can). Without
`TEST_DATABASE_URL` they are skipped. Use the password from your own `.env`; the compose default is
only for a fresh volume.

## Design decisions

- **Every tenant table has `tenant_id`**, and `positions` and `candidates` use `(tenant_id, id)` as
  their primary key. A row cannot be addressed without its school.
- **Constraints live in the database, not only in the API.** Subdomain format, colour codes, roles,
  vetting score range (0 to 25) and lowercase emails are `CHECK` constraints, so a bug in the API
  cannot store invalid data.
- **`vetting_total` is generated by the database**, so it cannot disagree with the four scores.
- **No personal data about students.** Candidates have a name and class because the election needs
  them; voters have nothing stored.

## Deviations from the charter (for review)

1. **Candidate to position link is a composite foreign key** `(tenant_id, position_id)`. The charter
   writes `REFERENCES positions(id)`, which PostgreSQL rejects because `id` alone is not unique
   (the charter also gives `positions` a composite primary key). The composite key additionally
   guarantees that a candidate and its position belong to the same school; a test proves it.
2. **Stricter nullability:** colours, `is_active` and `created_at` are `NOT NULL` with defaults, where
   the charter allows null.
3. **Emails must be lowercase** (`CHECK`), so the charter's `UNIQUE (tenant_id, email)` is effectively
   case-insensitive. The API must lowercase emails before saving.
4. **Role is checked** against `super_admin`, `admin`, `teacher` (Charter section 9).
5. `updated_at` is set by the application on update (Drizzle `$onUpdate`), not by a trigger.

## Open questions

- A `super_admin` has no school, but `users.tenant_id` is `NOT NULL` per the charter. Decide how
  platform operators are stored before EVT-103 (a platform tenant, or a nullable `tenant_id`).
