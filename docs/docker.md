# Running Evote with Docker

Starts Postgres 16, Redis 7.2 and the API with one command.

## First time

    cp .env.example .env
    docker compose up -d --build
    docker compose ps

All services should show `healthy`. Then check the API:

    curl http://localhost:3001/health

## Everyday commands

- Stop everything: `docker compose down`
- Stop and delete database data: `docker compose down -v`
- Follow API logs: `docker compose logs -f api`
- Rebuild the API after code changes: `docker compose up -d --build api`

## Database migrations and the application role

`docker compose up` runs a one-off `migrate` service before the API starts. It applies the
database migrations as the database owner, then gives the restricted role `evote_app` a login
(password `EVOTE_APP_PASSWORD`). The API connects as `evote_app`, **not** as the owner: the owner
bypasses row-level security, so the API refuses to start as it.

To run the migrations by hand, from the repository root:

    DATABASE_URL=postgres://evote:<password>@localhost:5432/evote \
      pnpm --filter @evote/database db:migrate

## Trying sign-up and login locally

Each school lives at `<school>.<TENANT_BASE_DOMAIN>` (`localhost` in `.env.example`). Until the
tenant API (EVT-102) exists, create a school by hand, then sign up its first administrator by
sending the school in the `Host` header:

    docker compose exec postgres psql -U evote -d evote \
      -c "insert into tenants (subdomain, school_name) values ('stmarys', 'St Marys')"

    curl -X POST http://localhost:3001/api/auth/signup \
      -H "Host: stmarys.localhost:3001" -H "Content-Type: application/json" \
      -d '{"email":"head@stmarys.test","password":"a-long-passphrase","fullName":"Head Teacher"}'

See [auth.md](auth.md) for the endpoints and the security rules.

## How the services connect

Containers reach each other by service name on a private network:

- API to Postgres: `postgres:5432`
- API to Redis: `redis:6379`

Settings come from `.env` (copied from `.env.example`). The values are for
development only.

## Known issue on GitHub Codespaces

If containers cannot reach each other (connection timed out), run this once
in the codespace. It resets when the codespace restarts:

    sudo sysctl -w net.bridge.bridge-nf-call-iptables=0

## Not included yet

The web (Next.js) container will be added after EVT-004 (apps/web) is merged.
