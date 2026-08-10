# Dastiyab — Claude Code Instructions

## Session Start

**Always read `CONTEXT.md` first**, then skim `docs/PRD.md` if the task touches product scope. `CONTEXT.md` contains the current phase status, what's been built, where we left off, and the immediate next step — this replaces reading individual source files to orient yourself. `docs/PRD.md` contains the product requirements and phase-by-phase feature scope.

## Saving Progress (do this before ending a session that changed project state)

- **`CONTEXT.md`** — update after any session that changes what's built, deployed, or left off: phase status, "Where We Left Off", "Last session ended" line (use the real current date), and "Current Codebase State". This is the single most important file to keep current — treat a session that changes code without updating it as unfinished.
- **`docs/PRD.md`** — update only when product scope itself changes: a feature moves in/out of v1, a phase's requirements change, target users or success criteria shift. Don't touch it for implementation-detail changes.
- **`CLAUDE.md`** (this file) — update when a *convention* changes: new route zone, new required env var, a constraint gets lifted, tech stack swap. Don't restate what CONTEXT.md already tracks (phase status, session history).

## Project Overview

Dastiyab is a multi-vendor e-commerce platform built with Next.js 16. Vendors create and manage their own stores, customers browse and place COD orders, and admins oversee the entire marketplace. Long-term vision: a self-serve platform like Shopify.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (Turbopack), React 19.2, Node 24 |
| Styling | Tailwind CSS v4 |
| Admin + Vendor UI | TailAdmin free Next.js template (components copied in) |
| Auth | Auth.js v5 (`next-auth@beta`) + Prisma adapter — roles: admin, vendor, customer |
| ORM | Prisma 7 + `@prisma/adapter-pg` (PostgreSQL driver adapter) |
| Database | PostgreSQL (local Docker for dev) |
| Image Storage | Cloudinary |
| Payments | COD only (Stripe deferred) |
| State | Redux Toolkit (cart, product, address, rating slices) |

## Running the Project

```bash
npm run dev       # starts Next.js dev server with Turbopack
npm run test:run  # runs the Vitest suite once (use this, not `npm test` — that's watch mode)
```

PostgreSQL must be running locally — `docker-compose.yml` (project root) starts a local `gocart_db` Postgres container (`docker compose up -d`). Set `DATABASE_URL` in `.env.local` to match. Run `nvm use 24` before starting (`.nvmrc` is set but nvm-windows doesn't auto-switch).

## Project Structure

```
app/
  (public)/       # customer storefront — public routes
  admin/          # admin panel — requires role: admin; actions.js has all admin Server Actions
  store/          # vendor dashboard — requires role: vendor; actions.js has all vendor Server Actions
  sign-in/        # Auth.js custom sign-in page (Google + credentials tabs)
  api/
    auth/         # NextAuth handler + credentials register route
    public/       # customer-facing, unauthenticated-safe API routes (products, categories, stores, coupon validation)
    customer/     # authenticated customer API routes (cart, addresses, orders, ratings, store lookup)
    upload/       # Cloudinary image upload (vendor/admin auth-guarded)

components/
  admin/          # TailAdmin-based admin components
    ui/           # shared primitives: StatCard, DataTable, Badge, PageHeader
  store/          # TailAdmin-based vendor components (reuses admin/ui/)
  (public)/       # storefront components

lib/
  prisma.js       # single shared Prisma client instance
  auth.js         # server-side auth helpers — requireAdmin, requireVendor, getAuthUser
  features/       # Redux slices (cart, product, address, rating)
  store.js        # Redux store
  syncCart.js     # fire-and-forget cart sync to DB

prisma/
  schema.prisma   # PostgreSQL schema — User, Account, Session, Product, Order, Store, Coupon, etc.
  generated/prisma/  # generated client — never edit directly, regenerate with `npx prisma generate`

auth.js            # NextAuth config (Google + Credentials providers, JWT callbacks)
proxy.js            # route protection middleware (Next.js 16 renamed middleware.js → proxy.js)

docs/
  PRD.md                                          # product requirements
  superpowers/specs/                              # per-phase design specs
  superpowers/plans/                               # per-phase implementation plans

tailadmin/          # reference clone of the upstream TailAdmin template (has its own .git) —
                     # source used to copy components from; not part of the app, not deployed
```

**Admin/vendor mutations are Server Actions, not REST routes.** `app/admin/actions.js` and `app/store/actions.js` hold all admin/vendor writes (guarded by `requireAdmin`/`requireVendor`). There is no `/api/admin/*` or `/api/store/*` REST surface — only `/api/public/*`, `/api/customer/*`, `/api/auth/*`, and `/api/upload`.

## Build Phases

Work proceeds in this order — each phase must be complete before the next. See `CONTEXT.md` for live status.

0. **Auth Migration** — Clerk → Auth.js v5 + Prisma adapter
1. **Foundation** — PostgreSQL + Prisma setup, Cloudinary config, route protection
2. **Admin Panel** — TailAdmin UI + admin Server Actions (6 pages)
3. **Vendor Dashboard** — TailAdmin UI + vendor Server Actions (5 pages) + Cloudinary upload endpoint
4. **Public Storefront** — Wire existing pages to real API routes
5. **Platform Services** — Coupon engine flags, product ratings
6. **Deployment** — Dockerfile, docker-compose.prod.yml, GitHub Actions deploy workflow

## Auth & Roles

Three roles stored in the `User.role` DB column, enforced via Auth.js v5 JWT sessions:

| Role | Assignment | Access |
|------|-----------|--------|
| `admin` | Set directly in DB: `UPDATE "User" SET role='admin' WHERE email='...'` then sign out/in | `/admin/*` |
| `vendor` | Set by `POST /api/public/stores` at store creation, forced sign-out | `/store/*` |
| `customer` | Default (`role` column default) | public routes + `/orders` |

## API Conventions

- All API routes and Server Actions check role server-side — never trust client-side role claims
- Admin/vendor **mutations are Server Actions** (`app/admin/actions.js`, `app/store/actions.js`), not REST routes — vendor actions derive `storeId` from the session via `requireVendor()`, never from client input
- `/api/customer/*` and `/api/public/*` routes follow REST conventions; customer routes derive the user from session, never accept a foreign user/store id from the request body
- Use the shared Prisma client from `lib/prisma.js` — never instantiate a new one in a route handler
- Return `{ error: string }` with appropriate HTTP status on failure

## Key Constraints

- COD payments only — no Stripe integration
- TailAdmin components live in `components/admin/` and `components/store/` — do not modify the upstream template files directly
- Shared UI primitives (`StatCard`, `DataTable`, `Badge`, `PageHeader`) live in `components/admin/ui/` and are imported by both admin and vendor components
- `next.config.mjs` has `images: { unoptimized: true }` and `output: 'standalone'` — Cloudinary is configured and the upload endpoint is live, but `unoptimized` hasn't been revisited since; don't assume it's still required, but don't flip it without checking why it was set
- Prisma 7 uses `@prisma/adapter-pg` — client is generated at `prisma/generated/prisma/`, imported via `@/prisma/generated/prisma`
- Prisma config lives in `prisma.config.ts` (project root) — database URL is loaded from `.env.local` via dotenv
- `"type": "module"` (full ESM) — required by the Prisma 7 generated client

## Environment Variables

All of the following are already set in `.env.local` for local dev:

```env
DATABASE_URL=postgresql://gocart:gocart@localhost:5432/gocart

NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<random-32-char-string>
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>

NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

NEXT_PUBLIC_CURRENCY_SYMBOL=...
```

Production deploy additionally needs `.env.production` (gitignored) with the same keys plus prod `DATABASE_URL`/`NEXTAUTH_URL` — see `.env.example` and the GitHub Actions secrets listed in `CONTEXT.md`.
