# EVOTE

A multi-tenant e-voting system for school elections.

## Repository layout

- `apps/api` - Fastify API service.
- `apps/web` - Next.js web application for election administration, teacher
  analytics, kiosk voting, and the public projector view.
- `packages/config` - Shared TypeScript, ESLint, and Prettier configuration.
- `workers` - Background jobs (as they are added).

## Getting started

Requirements: Node.js 22 or newer and pnpm 12.9.1.

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm format:check
pnpm -r typecheck
pnpm -r test
```

The web application is started with:

```bash
pnpm --filter @evote/web dev
```

## Why Next.js 16?

The web application uses Next.js 16 rather than the blueprint's Next.js 14
because the repository was initialized and validated against the current
Next.js release. Keeping the newer version avoids introducing an unnecessary
downgrade while preserving the App Router architecture described by the
blueprint.

More web-specific setup and route information is in
[`apps/web/README.md`](apps/web/README.md).
