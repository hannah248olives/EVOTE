# EVOTE
A multi-tenant e-voting system for school elections

## Troubleshooting

### Windows: pnpm will not run after a global npm install

pnpm 12 is a native program. Recent npm versions block install scripts by default, so a plain `npm install -g pnpm` leaves a placeholder file that fails to run. Install it with its script allowed, using the version pinned in `package.json`:

```bash
npm install -g --allow-scripts=pnpm pnpm@12.9.1
```

Then open a new terminal and check it with `pnpm -v`.
