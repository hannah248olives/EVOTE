# EVOTE web application

The `@evote/web` package is the Next.js 16 frontend for EVOTE. Next.js 16 is
used instead of the blueprint's Next.js 14 because the project was initialized
and validated against the newer release.

## Routes

- `/admin` - election configuration and device management.
- `/teacher` - read-only turnout analytics and standings.
- `/kiosk` - the locked-down student voting flow.
- `/projector` - the public live standings view.

## Development

From the repository root:

```bash
pnpm --filter @evote/web dev
pnpm --filter @evote/web lint
pnpm --filter @evote/web typecheck
```
