# Dastiyab — Session Context

> **Read this first at every session start.** This file is the single source of truth for project state. Update it on every progress save before ending a session.

---

## Project in One Sentence

Dastiyab is a multi-vendor e-commerce marketplace (Next.js 16) where vendors manage their own stores, customers place COD orders, and admins oversee the platform — built toward a Shopify-like vision.

---

## Tech Stack (Quick Reference)

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2.9 (Turbopack), React 19.2.7, Node 24 |
| Styling | Tailwind CSS v4 |
| Admin + Vendor UI | TailAdmin free Next.js template (components copied in) |
| Auth | Auth.js v5 (`next-auth@beta`) + Prisma adapter — roles: admin, vendor, customer |
| ORM | Prisma 7.8.0 + `@prisma/adapter-pg` (generated at `prisma/generated/prisma/`) |
| Database | PostgreSQL (local Docker, VPS later) |
| Images | Cloudinary |
| Payments | COD only (Stripe deferred) |
| State | Redux Toolkit (cart, product, address, rating slices) |
| Testing | Vitest |

---

## Build Phases

| # | Phase | Status | Plan File |
|---|-------|--------|-----------|
| 0 | Auth Migration — Replace Clerk with Auth.js v5 + Prisma adapter | ✅ Complete | `docs/superpowers/plans/2026-06-11-nextauth-migration.md` |
| 1 | Foundation — PostgreSQL, Prisma, Cloudinary, middleware | ✅ Complete | `docs/superpowers/plans/2026-06-11-phase-1-foundation.md` |
| 2 | Admin Panel — TailAdmin UI + 6 admin pages + API routes | ✅ Complete | `docs/superpowers/plans/2026-06-12-phase-2-admin-panel.md` |
| 3 | Vendor Dashboard — TailAdmin UI + 4 vendor pages + Cloudinary upload | ✅ Complete | `docs/superpowers/plans/2026-06-12-phase-3-vendor-dashboard.md` |
| 4 | Public Storefront — wire existing pages to real API routes | ✅ Complete | `docs/superpowers/specs/2026-06-12-phase-4-public-storefront-design.md` |
| 5 | Platform Services — coupon engine, ratings (Cloudinary already done in Phase 3) | ✅ Complete | `docs/superpowers/specs/2026-06-12-phase-5-platform-services-design.md` |

**Current phase:** Deployment infra — Docker + GitHub Actions CI/CD ✅ Complete (code); **production deploy status unverified** — no commits or confirmation since 2026-06-12  
**Last session ended:** 2026-08-11 — Documentation overhaul session (this session). No app code changed. Rewrote `CLAUDE.md`, `CONTEXT.md`, `docs/PRD.md` for accuracy and added an explicit save-progress protocol. See "2026-08-11 Session" below for details.

---

## Where We Left Off

All 6 phases (0–5) plus deployment infrastructure are code-complete as of 2026-06-12 (commit `8b2709a`). There is a ~2 month gap with no commits between then and this session (2026-08-11) — nothing indicates the deploy workflow was ever confirmed to succeed on a real VPS. **Treat "app is live" as unconfirmed until checked.**

All pages are wired to real PostgreSQL data:
- Products list, product detail, categories, store shop — `GET /api/public/*`
- Cart persistence — `GET|PUT /api/customer/cart`, Redux + DB sync via `lib/syncCart.js`
- Checkout — addresses (`GET|POST|DELETE /api/customer/addresses`), coupon validation, order placement (`POST /api/customer/orders`) with multi-store grouping in `$transaction`
- Orders page + ratings — `GET /api/customer/orders`, `POST /api/customer/ratings`
- Create Store — `POST /api/public/stores` (creates store, sets vendor role, signOut), `GET /api/customer/store`
- CartSync hydrates Redux cart from DB on login

**Immediate next step:** Decide whether to (a) verify/complete the VPS deploy (check GitHub Actions run history, confirm the app is actually reachable), or (b) start v2 features (Stripe, analytics, email notifications). Also resolve the housekeeping items below before further work.

**Housekeeping — untracked files as of 2026-08-11 (not yet committed, not previously documented):**
- `LICENSE.md`, `CODE_OF_CONDUCT.md` — added, presumably repo open-source prep; not yet committed
- `docker-compose.yml` (project root) — new local-dev Postgres compose file (separate from `docker-compose.prod.yml`); now documented in `CLAUDE.md`
- `tailadmin/` — confirmed to be a reference clone of the upstream TailAdmin template (has its own nested `.git`), used to copy components from during Phase 2/3. Not part of the app, not deployed. Consider adding to `.gitignore` so it stops showing in `git status`.
- `.gitignore` — modified to add `.env.production` and `GitHubSecrets.txt`, not yet committed

**Auth is fully configured** — `.env.local` already has `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` set (the old "add these before testing" note is stale, removed).
- To promote a user to admin: `UPDATE "User" SET role = 'admin' WHERE email = 'you@example.com';` then sign out/in

**Node 24 switch (manual):** Run `nvm use 24` in your terminal — `.nvmrc` is set but nvm-windows doesn't auto-switch.

---

## 2026-08-11 Session

Documentation-only session, no app code touched. Triggered by the docs having drifted from reality after the 2-month gap since the last commit.

Corrections made:
- `CLAUDE.md` said `sign-in/` was a Clerk page (stale — Phase 0 migrated to Auth.js) and described admin/vendor mutations as `/api/admin/*` / `/api/store/*` REST routes (wrong — they're Server Actions in `app/admin/actions.js` / `app/store/actions.js`; no such REST routes exist). Both fixed.
- `CLAUDE.md` Build Phases list was missing Phase 0 (Auth Migration) and Phase 6 (Deployment) — added.
- `docs/PRD.md` listed "VPS/production deployment configuration" under **Out of Scope (v1)**, but deployment infrastructure was actually built in a later session — moved to a Phase 6 entry and removed from out-of-scope (see PRD's own note on this).
- Added an explicit "Saving Progress" protocol to `CLAUDE.md` (documented-convention approach, no hooks) so future sessions update `CONTEXT.md`/`PRD.md` reliably instead of drifting again.

---

## Deployment Infrastructure (2026-06-12)

**Status:** Complete — deploy workflow running (last push: f65fd8c)

Files added:
- `Dockerfile` — multi-stage build (deps → builder → runner), Node 24 alpine, Next.js standalone output. Builder stage sets `ENV DATABASE_URL` to a dummy value so `prisma generate` loads `prisma.config.ts` without error (Prisma 7's `env()` is strict — throws if var missing even during generate).
- `docker-compose.prod.yml` — three services: postgres (healthcheck), app (runner stage), migrate (builder stage, exits after run)
- `.github/workflows/deploy.yml` — push to `deploy` branch → rsync → SSH: `set -e`, write `.env.production` + `chmod 600`, start postgres → run migrate → start app `--build`, `docker image prune -f`
- `prisma/migrations/20260612000000_init/migration.sql` — generated via `prisma migrate diff --from-empty`
- `.dockerignore`, `.env.example`

**Fixes applied during first deploy attempt:**
1. `Dockerfile` — added `ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"` in builder before `prisma generate`
2. All 11 admin/store pages — added `export const dynamic = 'force-dynamic'` (Next.js pre-renders server components at build time; without this, pages tried to query a non-existent DB)
3. `deploy.yml` — added `chmod 600`, `set -e`, split `up -d --build` into postgres → migrate → app ordering

**GitHub secrets required:** SERVER_HOST, SERVER_USER, SERVER_SSH_KEY, SERVER_APP_DIR, PRODUCTION_ENV

**VPS pre-deploy checklist:**
1. Docker + Docker Compose v2 installed
2. SSH key in ~/.ssh/authorized_keys
3. `$SERVER_APP_DIR/release/` directory exists
4. All 5 secrets configured in GitHub repository settings
5. Push a commit to `deploy` branch to trigger first deployment

---

## Key Files

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Dev conventions, API rules, constraints |
| `CONTEXT.md` | ← this file — session state |
| `docs/PRD.md` | Product requirements |
| `docs/superpowers/specs/2026-06-11-gocart-platform-design.md` | Full technical spec |
| `docs/superpowers/specs/2026-06-11-nextauth-migration-design.md` | Auth.js v5 migration spec |
| `docs/superpowers/plans/2026-06-11-phase-1-foundation.md` | Phase 1 step-by-step plan |
| `docs/superpowers/plans/2026-06-11-nextauth-migration.md` | Auth migration 13-task plan |
| `auth.js` | NextAuth config — Google + Credentials providers, JWT callbacks |
| `proxy.js` | Route protection — admin/vendor/customer role enforcement (renamed from middleware.js in Next.js 16) |
| `lib/auth.js` | Server-side auth helpers — requireAdmin, requireVendor, getAuthUser |
| `app/AuthProvider.jsx` | SessionProvider client wrapper for root layout |
| `components/admin/ui/UserMenu.jsx` | Replaces Clerk UserButton in admin + vendor navbars |
| `prisma/schema.prisma` | DB schema — User, Account, Session, VerificationToken, Product, Order, Store, Coupon, etc. |
| `prisma.config.ts` | Prisma 7 CLI config — loads `.env.local`, sets datasource URL |
| `prisma/generated/prisma/client.ts` | Generated Prisma client — do not edit; regenerate with `npx prisma generate` |
| `assets/assets.js` | All current dummy/mock data — replaced phase by phase |
| `app/admin/actions.js` | All Server Actions for admin panel — toggleStoreActive, approveStore, createCoupon, deleteCoupon, updateOrderStatus |
| `docs/superpowers/specs/2026-06-12-admin-panel-design.md` | Phase 2 design spec |
| `docs/superpowers/plans/2026-06-12-phase-2-admin-panel.md` | Phase 2 implementation plan |
| `docs/superpowers/specs/2026-06-12-vendor-dashboard-design.md` | Phase 3 design spec |
| `docs/superpowers/specs/2026-06-12-phase-4-public-storefront-design.md` | Phase 4 design spec |
| `docs/superpowers/plans/2026-06-12-phase-3-vendor-dashboard.md` | Phase 3 implementation plan |
| `app/store/actions.js` | All Server Actions for vendor mutations — createProduct, updateProduct, deleteProduct, toggleInStock, updateOrderStatus |
| `app/api/upload/route.js` | Cloudinary image upload endpoint (POST, auth-guarded) |

---

## Current Codebase State

- **Admin panel fully wired** — all 6 pages use real Prisma data; Server Actions handle all mutations
- **Vendor dashboard fully wired** — all 5 pages (dashboard, add-product, manage-product, edit-product, orders) use real Prisma data; Server Actions in `app/store/actions.js`
- **Cloudinary upload live** — `app/api/upload/route.js` handles image uploads for vendor + admin; returns `secure_url`
- **Public storefront fully wired** — all pages use real PostgreSQL data via REST APIs (Phase 4 complete)
- **Auth is fully wired** — Auth.js v5 (JWT strategy), Google + credentials providers, role-based middleware, custom sign-in page, UserMenu in admin/vendor navbars
- **No admin/vendor API routes** — mutations use Server Actions; only `/api/auth/*`, `/api/auth/register`, `/api/upload` exist
- **Public API routes** — `/api/public/products`, `/api/public/products/[id]`, `/api/public/categories`, `/api/public/stores/[username]`, `/api/public/stores` (POST), `/api/public/coupons/validate`
- **Customer API routes** — `/api/customer/cart`, `/api/customer/addresses`, `/api/customer/addresses/[id]`, `/api/customer/orders`, `/api/customer/ratings`, `/api/customer/store`
- **120 tests passing** — 15 test files: all Phase 1-5 routes covered
- **Docker PostgreSQL running** — `gocart_db` container, schema pushed
- **Prisma 7** — `@prisma/adapter-pg`, generated client at `prisma/generated/prisma/`, config in `prisma.config.ts`
- **Next.js 16.2.9** — server components + Server Actions pattern throughout admin + vendor panels
- **Node 24** — `.nvmrc` set; run `nvm use 24` manually to switch
- **`"type": "module"`** — full ESM
- **`.env.local` fully configured** — `DATABASE_URL`, `NEXTAUTH_URL`/`NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, Cloudinary vars, `NEXT_PUBLIC_CURRENCY_SYMBOL` all set

### Existing Route Zones

```
app/(public)/     — storefront: home, shop, product, cart, orders, pricing, create-store (mocked)
app/store/        — vendor dashboard: dashboard, add-product, manage-product, edit-product/[id], orders (REAL DATA)
app/admin/        — admin panel: dashboard, stores, approve, coupons, orders, users (REAL DATA)
```

### Existing Components
```
components/admin/   AdminLayout, AdminNavbar, AdminSidebar, StoreInfo
                    ui/UserMenu.jsx
                    + per-page clients: StoresClient, ApproveClient, CouponsClient, OrdersClient
components/store/   StoreLayout (wired to real auth + store), StoreNavbar, StoreSidebar
                    + per-page clients: ManageProductClient, OrdersClient
components/         Navbar, Footer, Hero, ProductCard, Banner, etc.
lib/features/       cartSlice, productSlice, addressSlice, ratingSlice (Redux)
app/admin/          actions.js — Server Actions for admin mutations
app/store/          actions.js — Server Actions for vendor mutations
app/api/upload/     route.js — Cloudinary image upload (vendor + admin auth)
app/store/add-product/    AddProductClient.jsx
app/store/edit-product/[id]/  EditProductClient.jsx
```

---

## Phase 0 Checklist ✅ Complete — Auth Migration

- [x] Task 1 — Swap `@clerk/nextjs` for `next-auth@beta`, `@auth/prisma-adapter`, `bcryptjs`
- [x] Task 2 — Update Prisma schema: User model + Account/Session/VerificationToken; `npx prisma db push --force-reset`
- [x] Task 3 — Create `auth.js` (NextAuth config: Google + Credentials, JWT callbacks, minimal user projection)
- [x] Task 4 — Create `app/api/auth/[...nextauth]/route.js` (handler export)
- [x] Task 5 — Create `app/api/auth/register/route.js` (bcrypt registration endpoint)
- [x] Task 6 — Replace `middleware.js` (Clerk → Auth.js, role-based protection)
- [x] Task 7 — Replace `lib/auth.js` helpers (requireAdmin, requireVendor, getAuthUser)
- [x] Task 8 — Create `app/AuthProvider.jsx` + update `app/layout.jsx` (ClerkProvider → AuthProvider)
- [x] Task 9 — Create `components/admin/ui/UserMenu.jsx` (Clerk UserButton replacement)
- [x] Task 10 — Update `components/admin/AdminNavbar.jsx` + `components/store/StoreNavbar.jsx`
- [x] Task 11 — Replace `app/sign-in/[[...sign-in]]/page.jsx` (Clerk SignIn → custom form with tabs)
- [x] Task 12 — Update `.env.local` / `.env.example` (swap Clerk vars for NextAuth + Google)
- [x] Task 13 — Update tests: `__tests__/lib/auth.test.js` + `__tests__/api/register.test.js` (14/14 passing)

---

## Phase 1 Checklist ✅ Complete

- [x] Task 1 — Install dependencies (`@clerk/nextjs`, `cloudinary`, `vitest`, `prisma@^6`, `@prisma/client@^6`)
- [x] Task 2 — Docker PostgreSQL + `.env.local`
- [x] Task 3 — Configure Prisma (remove driverAdapters, db push)
- [x] Task 4 — Set up Vitest
- [x] Task 5 — Prisma singleton (`lib/prisma.js`) + integration test
- [x] Task 6 — Auth helpers (`lib/auth.js`) + unit tests
- [x] Task 7 — Cloudinary helper (`lib/cloudinary.js`) + test
- [x] Task 8 — Clerk in app (`ClerkProvider` + sign-in page)
- [x] Task 9 — Middleware (route protection)
- [x] Task 10 — Update `.env.example` + full test suite (11/11 passing)

---

## Phase 2 Checklist ✅ Complete — Admin Panel

- [x] Task 1 — `app/admin/actions.js` — 5 Server Actions with `requireAdmin` guard, try/catch, enum validation
- [x] Task 2 — `AdminSidebar.jsx` — added Orders + Users nav links
- [x] Task 3 — `app/admin/page.jsx` — async server component, 5 parallel Prisma queries, real dashboard stats
- [x] Task 4 — `app/admin/stores/page.jsx` + `StoresClient.jsx` — server component + toggle active
- [x] Task 5 — `app/admin/approve/page.jsx` + `ApproveClient.jsx` — server component + approve/reject
- [x] Task 6 — `app/admin/coupons/page.jsx` + `CouponsClient.jsx` — server component + create/delete coupons
- [x] Task 7 — `app/admin/orders/page.jsx` + `OrdersClient.jsx` — new page, update order status
- [x] Task 8 — `app/admin/users/page.jsx` — new view-only server component
- [x] Tests — 26/26 passing (added 12 new tests for Server Actions)

---

## Phase 3 Checklist ✅ Complete — Vendor Dashboard

- [x] Task 1 — `app/store/actions.js` — 5 Server Actions (createProduct, updateProduct, deleteProduct, toggleInStock, updateOrderStatus) with `requireVendor` guard + ownership enforcement
- [x] Task 2 — `app/api/upload/route.js` — Cloudinary upload endpoint, auth-guarded (vendor or admin), returns `{ url: secure_url }`
- [x] Task 3 — `components/store/StoreLayout.jsx` — converted to async server component, real auth + store lookup, redirects if no session/store
- [x] Task 4 — `app/store/page.jsx` — async server component, 5 parallel Prisma queries (counts, earnings, recent ratings), date serialization
- [x] Task 5 — `app/store/add-product/page.jsx` + `AddProductClient.jsx` — 4 image slots, upload to `/api/upload`, calls `createProduct`
- [x] Task 6 — `app/store/manage-product/page.jsx` + `ManageProductClient.jsx` — product table with toggle + delete + edit link
- [x] Task 7 — `app/store/edit-product/[id]/page.jsx` + `EditProductClient.jsx` — pre-populated form with image replacement, calls `updateProduct`
- [x] Task 8 — `app/store/orders/page.jsx` + `OrdersClient.jsx` — orders table with status dropdown + order detail modal
- [x] Tests — 45/45 passing (added 15 store action tests + 3 upload route tests)

---

## Phase 4 Checklist ✅ Complete — Public Storefront

- [x] Task 1 — `app/api/public/products/route.js` — GET with pagination, search, category, storeId, sort; base where: inStock+isActive
- [x] Task 2 — `app/api/public/products/[id]/route.js` + `app/api/public/categories/route.js` — product detail + distinct categories
- [x] Task 3 — `app/api/public/stores/[username]/route.js` — store lookup, strips internal fields
- [x] Task 4 — `app/api/public/coupons/validate/route.js` — POST, case-insensitive, expiry check
- [x] Task 5 — `app/api/customer/cart/route.js` — GET (unauthenticated returns empty cart), PUT (validates cart shape)
- [x] Task 6 — `app/api/customer/addresses/route.js` + `[id]/route.js` — CRUD with all 8 required fields, ownership check on DELETE
- [x] Task 7 — `app/api/customer/orders/route.js` — GET user orders; POST multi-store order in $transaction, address ownership check, server-side prices
- [x] Task 8 — `app/api/customer/ratings/route.js` — POST with DELIVERED check, duplicate prevention
- [x] Task 9 — `lib/features/cart/cartSlice.js` (added setCart), `lib/features/product/productSlice.js` (removed mock data), `lib/syncCart.js` (fire-and-forget cart sync)
- [x] Task 10 — `components/CartSync.jsx` + `app/layout.jsx` — hydrates Redux cart from DB on login, merge rule: max qty
- [x] Task 11 — `components/LatestProducts.jsx`, `BestSelling.jsx`, `CategoriesMarquee.jsx` — fetch from real APIs
- [x] Task 12 — `app/(public)/shop/page.jsx` — infinite scroll + IntersectionObserver + Load More fallback
- [x] Task 13 — `app/(public)/shop/[username]/page.jsx` — store info + paginated products
- [x] Task 14 — `app/(public)/product/[productId]/page.jsx` + `ProductDetails.jsx` + `Counter.jsx` — syncCart on add/remove
- [x] Task 15 — `app/(public)/cart/page.jsx` — Promise.all product fetches, syncCart on delete
- [x] Task 16 — `components/OrderSummary.jsx` + `AddressModal.jsx` — addresses, coupon, place order; all 8 address fields
- [x] Task 17 — `app/(public)/orders/page.jsx` + `OrderItem.jsx` + `RatingModal.jsx` — orders list + POST rating; fixed toast.promise bug + 0-star validation
- [x] Task 18 — `app/(public)/create-store/page.jsx` + `app/api/customer/store/route.js` + `app/api/public/stores/route.js` — store creation flow, vendor role update, signOut
- [x] Tests — 106/106 passing (all new API routes covered, no regressions)

---

## Phase 5 Checklist ✅ Complete — Platform Services

- [x] Task 1 — `app/api/public/coupons/validate/route.js` — enforce isPublic, forMember, forNewUser flags; auth-aware via getAuthUser()
- [x] Task 2 — `app/api/customer/orders/route.js` — re-check isPublic and forNewUser at order placement as security backstop
- [x] Task 3 — `app/api/public/products/route.js` — compute averageRating + ratingCount, strip raw rating array from list response
- [x] Task 3 — `app/api/public/products/[id]/route.js` — compute averageRating + ratingCount, keep full rating array in detail response
- [x] Tests — 120/120 passing (added 14 new tests across 3 test files)

---

## Key Conventions (enforced in CLAUDE.md)

- Vendor API routes (`/api/store/*`) derive `storeId` from the session — never accept it from request body
- All admin/vendor API routes verify role server-side via `requireAdmin()` / `requireVendor()` from `lib/auth.js`
- Use `lib/prisma.js` singleton — never `new PrismaClient()` in a route handler
- Shared UI primitives live in `components/admin/ui/` — used by both admin and vendor zones
- COD only — no Stripe code
- Prisma 7: after schema changes run `npx prisma generate` then `npx prisma db push`; never edit `prisma/generated/` directly

---

## How to Update This File

At the end of every session that changes project state, update:
1. **Phase status** — change 🔲 to 🔄 (in progress) or ✅ (complete)
2. **Current phase** line
3. **Last session ended** line with the real current date and what was accomplished
4. **Phase checklist** — check off completed tasks
5. **Codebase state** — update what's no longer mocked/missing

Also update `docs/PRD.md` if the session changed product scope (a feature moved in/out of v1, requirements shifted), and `CLAUDE.md` if it changed a convention (new route zone, new env var, lifted constraint). See `CLAUDE.md`'s "Saving Progress" section for the full split. Don't let this file, `CLAUDE.md`, and `docs/PRD.md` drift out of sync with each other or with the actual repo state — verify against `git log`/`git status` if it's been a while since the last update, the way the 2026-08-11 session did.

---

## Decisions Log

| Decision | Reason |
|----------|--------|
| COD only, no Stripe | Stripe not available in Pakistan |
| PostgreSQL over Supabase | Simpler setup, direct connection, VPS-friendly |
| TailAdmin for admin + vendor only | TailAdmin is a back-office UI — wrong fit for customer storefront |
| NextAuth over Clerk | Self-hosted, no third-party dependency, full control over auth flow |
| Cloudinary for images | Generous free tier, built-in CDN, simple Next.js integration |
| Same repo for admin | Simpler — one deploy, shared Prisma schema |
| Prisma 7 driver adapter | Required by Prisma 7 — `@prisma/adapter-pg` replaces built-in driver |
| Node 24 | Active LTS (Node 22 entered Maintenance LTS April 2026) |
| `"type": "module"` | Required by Prisma 7 generated client; all files already used ESM syntax |
