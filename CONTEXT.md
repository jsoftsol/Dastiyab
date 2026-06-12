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
| 4 | Public Storefront — wire existing pages to real API routes | 🔄 In progress | `docs/superpowers/specs/2026-06-12-phase-4-public-storefront-design.md` |
| 5 | Platform Services — coupon engine, ratings (Cloudinary already done in Phase 3) | 🔲 Not started | _(create when Phase 4 done)_ |

**Current phase:** Phase 4 — Public Storefront (design approved, implementation plan not yet written)  
**Last session ended:** 2026-06-12 — Phase 4 design spec written and committed. API-routes + client components approach chosen for mobile-app compatibility. DB-persisted cart (`User.cart` JSON), infinite scroll + Load More fallback, full checkout flow (addresses, coupon validation, order placement, ratings). 14 new API routes across `/api/public/*` and `/api/customer/*`. Target ~75 tests.

---

## Where We Left Off

Project renamed to **Dastiyab** and pushed to https://github.com/jsoftsol/Dastiyab.git. Phase 3 (Vendor Dashboard) is complete — all 5 vendor pages wired to real PostgreSQL data, Cloudinary upload live, 45/45 tests passing.

**Immediate next step:** Phase 4 implementation plan — invoke `writing-plans` skill to create the step-by-step plan from `docs/superpowers/specs/2026-06-12-phase-4-public-storefront-design.md`.

**Before manual testing of auth:** Add Google OAuth credentials to `.env.local`:
- `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` (from Google Cloud Console)
- To promote a user to admin: `UPDATE "User" SET role = 'admin' WHERE email = 'you@example.com';` then sign out/in

**Node 24 switch (manual):** Run `nvm use 24` in your terminal — `.nvmrc` is set but nvm-windows doesn't auto-switch.

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
| `middleware.js` | Route protection — admin/vendor/customer role enforcement |
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
- **Public storefront still mocked** — Phase 4 wires these
- **Auth is fully wired** — Auth.js v5 (JWT strategy), Google + credentials providers, role-based middleware, custom sign-in page, UserMenu in admin/vendor navbars
- **No admin/vendor API routes** — mutations use Server Actions; only `/api/auth/*`, `/api/auth/register`, `/api/upload` exist
- **45 tests passing** — 8 test files: smoke, auth helpers, cloudinary, prisma, register endpoint, admin actions, store actions, upload route
- **Docker PostgreSQL running** — `gocart_db` container, schema pushed
- **Prisma 7** — `@prisma/adapter-pg`, generated client at `prisma/generated/prisma/`, config in `prisma.config.ts`
- **Next.js 16.2.9** — server components + Server Actions pattern throughout admin + vendor panels
- **Node 24** — `.nvmrc` set; run `nvm use 24` manually to switch
- **`"type": "module"`** — full ESM
- **`.env.local` needs `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`** for Google OAuth

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

## Key Conventions (enforced in CLAUDE.md)

- Vendor API routes (`/api/store/*`) derive `storeId` from the session — never accept it from request body
- All admin/vendor API routes verify role server-side via `requireAdmin()` / `requireVendor()` from `lib/auth.js`
- Use `lib/prisma.js` singleton — never `new PrismaClient()` in a route handler
- Shared UI primitives live in `components/admin/ui/` — used by both admin and vendor zones
- COD only — no Stripe code
- Prisma 7: after schema changes run `npx prisma generate` then `npx prisma db push`; never edit `prisma/generated/` directly

---

## How to Update This File

At the end of every session, update:
1. **Phase status** — change 🔲 to 🔄 (in progress) or ✅ (complete)
2. **Current phase** line
3. **Last session ended** line with date and what was accomplished
4. **Phase checklist** — check off completed tasks
5. **Codebase state** — update what's no longer mocked/missing

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
