# Build context is the repo root:
#   docker build -f apps/api/Dockerfile -t evote-api:dev .

FROM node:22-alpine AS base
RUN npm install -g pnpm@12.9.1
WORKDIR /app

# ---- build: install everything and compile TypeScript ----
FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/config/package.json packages/config/
COPY packages/database/package.json packages/database/
RUN pnpm install --frozen-lockfile --filter @evote/api...
COPY packages/config/tsconfig.base.json packages/config/
COPY packages/database packages/database
COPY apps/api apps/api
# Builds @evote/database first, then the API.
RUN pnpm --filter @evote/api build

# ---- prod-deps: production dependencies only ----
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/config/package.json packages/config/
COPY packages/database/package.json packages/database/
RUN pnpm install --frozen-lockfile --prod --filter @evote/api...

# ---- runtime: small final image ----
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=prod-deps /app/packages/database/node_modules ./packages/database/node_modules
COPY --from=build /app/packages/database/dist ./packages/database/dist
# The SQL migrations, used by the migrate command (see docker-compose.yml).
COPY --from=build /app/packages/database/drizzle ./packages/database/drizzle
COPY packages/database/package.json ./packages/database/
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY apps/api/package.json ./apps/api/
WORKDIR /app/apps/api
USER node
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD node -e "fetch('http://localhost:3001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]
