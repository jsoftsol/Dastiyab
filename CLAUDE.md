# Dastiyab — Claude Code Instructions

## Session Start

**Always read `CONTEXT.md` first.** It contains the current phase status, what's been built, where we left off, and the immediate next step. This replaces reading individual source files to orient yourself.

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
```

PostgreSQL must be running locally. Set `DATABASE_URL` in `.env.local`.

## Project Structure

```
app/
  (public)/       # customer storefront — public routes
  admin/          # admin panel — requires role: admin
  store/          # vendor dashboard — requires role: vendor
  sign-in/        # Clerk sign-in page
  api/
    admin/        # admin API routes
    store/        # vendor API routes (scoped to vendor's store)
    public/       # customer-facing API routes
    upload/       # Cloudinary image upload

components/
  admin/          # TailAdmin-based admin components
    ui/           # shared primitives: StatCard, DataTable, Badge, PageHeader
  store/          # TailAdmin-based vendor components (reuses admin/ui/)
  (public)/       # storefront components

lib/
  prisma.js       # single shared Prisma client instance
  features/       # Redux slices (cart, product, address, rating)
  store.js        # Redux store

prisma/
  schema.prisma   # PostgreSQL schema — User, Product, Order, Store, Coupon, etc.

docs/
  PRD.md                                          # product requirements
  superpowers/specs/2026-06-11-gocart-platform-design.md  # technical spec
```

## Build Phases

Work proceeds in this order — each phase must be complete before the next:

1. **Foundation** — Clerk auth, PostgreSQL + Prisma setup, Cloudinary config, middleware
2. **Admin Panel** — TailAdmin UI + admin API routes (6 pages)
3. **Vendor Dashboard** — TailAdmin UI + vendor API routes (4 pages)
4. **Public Storefront** — Wire existing pages to real API routes
5. **Platform Services** — Cloudinary uploads, coupon engine, ratings

## Auth & Roles

Three roles stored in the `User.role` DB column, enforced via Auth.js v5 JWT sessions:

| Role | Assignment | Access |
|------|-----------|--------|
| `admin` | Set directly in DB: `UPDATE "User" SET role='admin' WHERE email='...'` then sign out/in | `/admin/*` |
| `vendor` | Set by `POST /api/public/stores` at store creation, forced sign-out | `/store/*` |
| `customer` | Default (`role` column default) | public routes + `/orders` |

## API Conventions

- All API routes check role server-side — never trust client-side role claims
- Vendor API routes (`/api/store/*`) are scoped to the authenticated user's store only — never accept `storeId` from the request body, always derive it from the session
- Use the shared Prisma client from `lib/prisma.js` — never instantiate a new one in a route handler
- Return `{ error: string }` with appropriate HTTP status on failure

## Key Constraints

- COD payments only — no Stripe integration
- TailAdmin components live in `components/admin/` and `components/store/` — do not modify the upstream template files directly
- Shared UI primitives (`StatCard`, `DataTable`, `Badge`, `PageHeader`) live in `components/admin/ui/` and are imported by both admin and vendor components
- `next.config.mjs` currently has `images: { unoptimized: true }` — leave as-is until Cloudinary is configured
- Prisma 7 uses `@prisma/adapter-pg` — client is generated at `prisma/generated/prisma/`, imported via `@/prisma/generated/prisma`
- Prisma config lives in `prisma.config.ts` (project root) — database URL is loaded from `.env.local` via dotenv

## Environment Variables

```env
DATABASE_URL=postgresql://user:password@localhost:5432/gocart

NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<random-32-char-string>
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>

NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```
