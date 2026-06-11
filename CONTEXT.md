# GoCart — Session Context

> **Read this first at every session start.** This file is the single source of truth for project state. Update it on every progress save before ending a session.

---

## Project in One Sentence

GoCart is a multi-vendor e-commerce marketplace (Next.js 15) where vendors manage their own stores, customers place COD orders, and admins oversee the platform — built toward a Shopify-like vision.

---

## Tech Stack (Quick Reference)

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15.3.5 (Turbopack), React 19 |
| Styling | Tailwind CSS v4 |
| Admin + Vendor UI | TailAdmin free Next.js template (components copied in) |
| Auth | Auth.js v5 (`next-auth@beta`) + Prisma adapter — roles: admin, vendor, customer |
| ORM | Prisma + standard PostgreSQL driver |
| Database | PostgreSQL (local Docker, VPS later) |
| Images | Cloudinary |
| Payments | COD only (Stripe deferred) |
| State | Redux Toolkit (cart, product, address, rating slices) |
| Testing | Vitest |

---

## Build Phases

| # | Phase | Status | Plan File |
|---|-------|--------|-----------|
| 0 | Auth Migration — Replace Clerk with Auth.js v5 + Prisma adapter | 🔄 In progress | `docs/superpowers/plans/` _(create next)_ |
| 1 | Foundation — Clerk, PostgreSQL, Prisma, Cloudinary, middleware | ✅ Complete | `docs/superpowers/plans/2026-06-11-phase-1-foundation.md` |
| 2 | Admin Panel — TailAdmin UI + 6 admin pages + API routes | 🔲 Not started | _(create when Phase 0 done)_ |
| 3 | Vendor Dashboard — TailAdmin UI + 4 vendor pages + API routes | 🔲 Not started | _(create when Phase 2 done)_ |
| 4 | Public Storefront — wire existing pages to real API routes | 🔲 Not started | _(create when Phase 3 done)_ |
| 5 | Platform Services — Cloudinary uploads, coupon engine, ratings | 🔲 Not started | _(create when Phase 4 done)_ |

**Current phase:** Phase 0 — Auth Migration (in progress)  
**Last session ended:** 2026-06-11 — design spec approved, implementation plan written. Plan at `docs/superpowers/plans/2026-06-11-nextauth-migration.md`. 13 tasks. Implementation started via subagent-driven approach.

---

## Where We Left Off

Phase 1 is complete. Now migrating auth from Clerk to Auth.js v5 before starting Phase 2.

**Immediate next step:** Execute the auth migration plan at `docs/superpowers/plans/2026-06-11-nextauth-migration.md` task by task using subagent-driven-development skill.

**Important — credentials needed in `.env.local` after migration:**
- NextAuth: `NEXTAUTH_URL`, `NEXTAUTH_SECRET` (any random 32-char string)
- Google OAuth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (from Google Cloud Console)
- Cloudinary keys: get from https://cloudinary.com → Dashboard

---

## Key Files

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Dev conventions, API rules, constraints |
| `CONTEXT.md` | ← this file — session state |
| `docs/PRD.md` | Product requirements |
| `docs/superpowers/specs/2026-06-11-gocart-platform-design.md` | Full technical spec |
| `docs/superpowers/plans/2026-06-11-phase-1-foundation.md` | Phase 1 step-by-step plan |
| `prisma/schema.prisma` | DB schema — User, Product, Order, Store, Coupon, etc. |
| `assets/assets.js` | All current dummy/mock data — replaced phase by phase |

---

## Current Codebase State

- **All data is mocked** via `assets/assets.js` — no real DB calls yet (Phase 4 wires these)
- **Auth is wired** — Clerk middleware protects `/admin/*`, `/store/*`, `/orders`
- **No API routes** — none exist yet (Phases 2–4)
- **11 tests passing** — Vitest configured with smoke, auth, cloudinary, prisma tests
- **Docker PostgreSQL running** — `gocart_db` container, all schema tables created
- **Prisma 6** — standard driver, `lib/prisma.js` singleton ready
- **`.env.local` needs real Clerk + Cloudinary keys** before the app is functional

### Existing Route Zones

```
app/(public)/     — storefront: home, shop, product, cart, orders, pricing, create-store
app/store/        — vendor dashboard: dashboard, add-product, manage-product, orders
app/admin/        — admin panel: dashboard, stores, approve, coupons
```

### Existing Components
```
components/admin/   AdminLayout, AdminNavbar, AdminSidebar, StoreInfo
components/store/   StoreLayout, StoreNavbar, StoreSidebar
components/         Navbar, Footer, Hero, ProductCard, Banner, etc.
lib/features/       cartSlice, productSlice, addressSlice, ratingSlice (Redux)
```

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

## Key Conventions (enforced in CLAUDE.md)

- Vendor API routes (`/api/store/*`) derive `storeId` from the session — never accept it from request body
- All admin/vendor API routes verify role server-side via `requireAdmin()` / `requireVendor()` from `lib/auth.js`
- Use `lib/prisma.js` singleton — never `new PrismaClient()` in a route handler
- Shared UI primitives live in `components/admin/ui/` — used by both admin and vendor zones
- COD only — no Stripe code
- No `driverAdapters` in Prisma

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
