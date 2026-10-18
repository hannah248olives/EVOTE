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
