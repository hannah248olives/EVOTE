# EVOTE
# Multi-Tenant School Voting System

A kiosk-first, zero-PII, multi-tenant SaaS platform for conducting
school elections. Students vote on locked-down tablets; results
appear live on a projector; teachers get read-only analytics; and
detailed votes auto-purge after 30 days.

## What It Does

- **Zero student PII** — no names, emails, or rosters ever stored
- **Kiosk-first** — tablets locked into a single-purpose voting view
- **Real-time projector** — assembly hall sees live standings instantly
- **Teacher analytics** — read-only dashboards with candidate performance
- **Multi-tenant** — one deployment serves many schools, fully isolated
- **Auto-purge** — detailed votes deleted after 30 days; aggregates kept

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (React) + Tailwind CSS |
| Backend | Fastify (Node.js) + TypeScript |
| Database | PostgreSQL 16 (Row-Level Security) |
| Cache / Tally | Redis 7.2 (Sorted Sets, Pub/Sub) |
| Queue | BullMQ |
| Realtime | WebSocket (Socket.io / Ably) |
| Storage | Cloudflare R2 |
| Infra | Terraform + Kubernetes (EKS) |
| CI/CD | GitHub Actions |

## Prerequisites

Make sure you have these installed:

- **Node.js 20+** — [Download](https://nodejs.org)
- **pnpm 9+** — `npm install -g pnpm`
- **Docker Desktop** — [Download](https://www.docker.com/products/docker-desktop)
- **Git** — [Download](https://git-scm.com)

Verify:

```bash
node --version   # Should print v20.x or higher
pnpm --version   # Should print 9.x or higher
docker --version # Should print Docker version 24.x or higher