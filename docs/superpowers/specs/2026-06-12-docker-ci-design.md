# Docker + CI/CD Design

**Date:** 2026-06-12
**Status:** Approved

---

## Overview

Add production Docker configuration and a GitHub Actions CI/CD pipeline to Dastiyab. The setup is modeled after the tenovo project. Deployment is triggered by pushing to a `deploy` branch; GitHub Actions rsync the code to a VPS and SSH in to rebuild and restart containers.

No Redis, no workers, no realtime services — Dastiyab is simpler than tenovo. Three production containers: `postgres`, `app`, `migrate`.

---

## 1. Files

| File | Action |
|------|--------|
| `Dockerfile` | New — multi-stage build |
| `docker-compose.prod.yml` | New — production services |
| `.dockerignore` | New — exclude build/secret files |
| `.github/workflows/deploy.yml` | New — CI/CD pipeline |
| `.env.example` | New — documents required env vars |
| `next.config.mjs` | Modify — add `output: 'standalone'` |
| `prisma/migrations/` | Create — run `prisma migrate dev --name init` locally once |

The existing `docker-compose.yml` (dev PostgreSQL) is unchanged.

---

## 2. Dockerfile

Three stages using `node:24-alpine`:

### `deps` stage
```dockerfile
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
```

### `builder` stage
```dockerfile
FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build
```

Produces `.next/standalone` output (requires `output: 'standalone'` in next.config.mjs).

### `runner` stage
```dockerfile
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
```

The `migrate` service uses the `builder` stage target (has Node, Prisma CLI, and `prisma/migrations/` in the image). The `runner` stage contains no Prisma binaries.

---

## 3. docker-compose.prod.yml

Three services, one bridge network, one named volume:

| Service | Image target | Notes |
|---------|-------------|-------|
| `postgres` | `postgres:17-alpine` | Named volume `dastiyab_postgres_data`; reads `POSTGRES_USER/PASSWORD/DB` from env file |
| `app` | `runner` | Port `127.0.0.1:${APP_PORT:-7000}:3000` (localhost-only, behind reverse proxy); `depends_on: postgres`; `restart: unless-stopped` |
| `migrate` | `builder` | `command: npx prisma migrate deploy`; runs once and exits; no restart policy |

`DATABASE_URL` in `.env.production` must use the Docker service hostname:
```
DATABASE_URL=postgresql://user:pass@dastiyab_postgres:5432/dastiyab_db
```

---

## 4. GitHub Actions — deploy.yml

**Trigger:** push to `deploy` branch, or `workflow_dispatch`.

**Steps:**

1. `actions/checkout@v4`
2. `burnett01/rsync-deployments` — rsync to `$SERVER_APP_DIR/release/`, excluding: `.git`, `.github`, `node_modules`, `.next`, `.env*`
3. SSH: `echo "${{ secrets.PRODUCTION_ENV }}" > $SERVER_APP_DIR/.env.production`
4. SSH: `docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build`
5. SSH: `docker compose --env-file .env.production -f docker-compose.prod.yml run --rm migrate`
6. SSH: `docker image prune -f`

**Required GitHub secrets:**

| Secret | Description |
|--------|-------------|
| `SERVER_HOST` | VPS IP or hostname |
| `SERVER_USER` | SSH username |
| `SERVER_SSH_KEY` | Private SSH key |
| `SERVER_APP_DIR` | Absolute path on VPS, e.g. `/home/deploy/dastiyab` |
| `PRODUCTION_ENV` | Full multiline `.env.production` content |

`PRODUCTION_ENV` must include: `DATABASE_URL` (container hostname), `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.

---

## 5. next.config.mjs Change

Add `output: 'standalone'` (required for the Dockerfile's standalone copy step):

```js
const nextConfig = {
  output: 'standalone',
  images: { unoptimized: true }
}
```

---

## 6. Initial Prisma Migration (One-Time)

Before the first deploy, create the initial migration file locally:

```bash
npx prisma migrate dev --name init
```

This generates `prisma/migrations/<timestamp>_init/migration.sql` from the current schema. Commit the file — it gets rsync'd to the VPS and `prisma migrate deploy` applies it on first run.

Note: after running `migrate dev`, use `prisma migrate dev` for all future local schema changes instead of `prisma db push`. The `prisma.config.ts` file needs no changes — `dotenv.config({ path: '.env.local' })` fails silently in Docker (file absent), and `DATABASE_URL` is already in the container environment.

---

## 7. Scope

- No Redis, no workers, no realtime services
- No Stripe integration
- No Nginx config (reverse proxy assumed to be pre-configured on VPS)
- No health check endpoint added (can be added later)
- COD only
