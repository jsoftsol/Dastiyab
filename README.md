# Dastiyab — Multi-Vendor E-Commerce Platform

A production-grade, multi-tenant marketplace built with Next.js 16. Vendors self-onboard and manage independent storefronts; customers browse, place orders, and track deliveries; admins govern the entire platform — all from a single codebase.

> Think Shopify meets a regional marketplace — built ground-up on a modern React/Node stack.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Next.js 16 App Router               │
├──────────────┬──────────────────────┬───────────────────┤
│  Customer    │   Vendor Dashboard   │    Admin Panel    │
│  Storefront  │   /store/* (SSR)     │  /admin/* (SSR)   │
│  /(public)/  │   TailAdmin UI       │  TailAdmin UI     │
├──────────────┴──────────────────────┴───────────────────┤
│         Auth.js v5  (JWT · Google OAuth · Credentials)   │
│              Role enforcement via Edge Middleware         │
├─────────────────────────────────────────────────────────┤
│          Prisma 7  +  PostgreSQL  (Docker / VPS)         │
├─────────────────────────────────────────────────────────┤
│           Cloudinary CDN  ·  Redux Toolkit (client)      │
└─────────────────────────────────────────────────────────┘
```

Three fully isolated role zones share one PostgreSQL schema and one deployment. Server Components handle all data fetching; Server Actions handle all mutations — zero REST endpoints in the admin/vendor layer.

---

## Tech Stack

| Concern | Choice | Notes |
|---------|--------|-------|
| Framework | Next.js 16.2.9 (Turbopack) | App Router, RSC, Server Actions |
| Language | React 19.2, Node 24, full ESM | `"type": "module"` throughout |
| Styling | Tailwind CSS v4 | JIT, zero config |
| Back-office UI | TailAdmin (Next.js) | Components copied-in, not a runtime dependency |
| Auth | Auth.js v5 (`next-auth@beta`) | Google OAuth + Credentials; JWT strategy; Prisma adapter |
| ORM | Prisma 7 + `@prisma/adapter-pg` | Driver-adapter pattern; generated client in `prisma/generated/` |
| Database | PostgreSQL | Docker locally; any VPS Postgres in production |
| Image CDN | Cloudinary | Vendor product images; auth-gated upload endpoint |
| State (client) | Redux Toolkit | Cart, address, ratings — client-only slices |
| Testing | Vitest | 45 tests across 8 suites; unit + integration |

---

## Features

### Customer Storefront
- Product catalog with category filtering and search
- Product detail pages with image gallery and star ratings
- Persistent cart (Redux + localStorage)
- Checkout with saved delivery addresses (add / select at purchase)
- COD order placement and live order status tracking
- Individual vendor store profile pages

### Vendor Dashboard
- Self-serve store creation and onboarding flow
- Product management — create, edit, delete, toggle stock availability
- Up to 4 Cloudinary-hosted product images per listing
- Order management with status progression (Placed → Processing → Shipped → Delivered)
- Revenue dashboard: earnings summary, product counts, recent customer ratings

### Admin Panel
- Platform KPIs: order volume, GMV, user counts, pending approvals
- Store approval workflow — approve or reject vendor applications
- Store activation toggle — suspend a live store instantly
- User directory and role inspection
- Coupon engine — create discount codes with percentage off, expiry date, and audience targeting (new user / member / public)
- Cross-platform order management and status overrides

### Platform-Wide
- Role-based access control enforced at the Edge (Next.js middleware) and server (`lib/auth.js` helpers)
- All vendor data strictly scoped to session — `storeId` is always derived server-side, never accepted from the client
- Shared Prisma singleton — no `new PrismaClient()` in route handlers
- Cloudinary upload endpoint auth-gated to `vendor` and `admin` roles

---

## Data Model

```
User ──< Order (as buyer)
User ──  Store (1:1, vendor)
Store ──< Product
Store ──< Order
Order ──< OrderItem >── Product
Product ──< Rating
User ──< Rating
User ──< Address
Order >── Address
Coupon (standalone — validated at checkout)
Auth.js: Account, Session, VerificationToken
```

Selected schema decisions:

- `User.role` (`customer` | `vendor` | `admin`) — single source of truth for RBAC, checked server-side on every protected route
- `Store.status` (`pending` | `approved` | `rejected`) + `Store.isActive` — two-gate model separating onboarding approval from runtime suspension
- `Order.coupon Json` — coupon snapshot embedded at order time, immune to future edits or deletions
- `User.cart Json` — server-side cart fallback alongside Redux client state

---

## Project Structure

```
app/
  (public)/         customer storefront — home, shop, product, cart, orders
  admin/            admin panel — dashboard, stores, approve, coupons, orders, users
    actions.js      all admin Server Actions (requireAdmin guard)
  store/            vendor dashboard — dashboard, add/edit/manage products, orders
    actions.js      all vendor Server Actions (requireVendor + ownership check)
  api/
    auth/           Auth.js handler + registration endpoint
    upload/         Cloudinary image upload (auth-gated)
  sign-in/          custom sign-in page — Google OAuth + email/password tabs

components/
  admin/            TailAdmin-based admin components
    ui/             shared primitives: StatCard, DataTable, Badge, PageHeader
  store/            vendor components (reuses admin/ui/ primitives)
  (public)/         storefront: Navbar, Footer, Hero, ProductCard, Banner

lib/
  prisma.js         shared Prisma client singleton
  auth.js           requireAdmin(), requireVendor(), getAuthUser() helpers
  cloudinary.js     Cloudinary SDK wrapper
  features/         Redux slices: cartSlice, productSlice, addressSlice, ratingSlice
  store.js          Redux store

prisma/
  schema.prisma     canonical DB schema
  generated/        Prisma 7 generated client — do not edit

__tests__/          Vitest test suites (45 tests, 8 files)
docs/               PRD, technical specs, implementation plans
```

---

## Getting Started

### Prerequisites

- Node 24 (`nvm use 24`)
- Docker (for local PostgreSQL)
- Cloudinary account (free tier sufficient)
- Google Cloud project with OAuth 2.0 credentials

### 1 — Clone and install

```bash
git clone https://github.com/jsoftsol/Dastiyab.git
cd Dastiyab
npm install
```

### 2 — Start PostgreSQL

```bash
docker compose up -d
```

### 3 — Environment variables

Copy `.env.example` to `.env.local` and populate:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/dastiyab

NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<32-char random string — openssl rand -base64 32>

GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>

NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

### 4 — Push the schema and generate the Prisma client

```bash
npx prisma db push
npx prisma generate
```

### 5 — Run

```bash
npm run dev      # Turbopack dev server → http://localhost:3000
```

### 6 — Promote your account to admin

Sign in once with your email, then run:

```sql
UPDATE "User" SET role = 'admin' WHERE email = 'you@example.com';
```

Sign out and back in — you'll be routed to `/admin`.

---

## Testing

```bash
npm test             # run all 45 tests
npm run test:watch   # watch mode
```

| Suite | Tests | What is covered |
|-------|-------|-----------------|
| smoke | 2 | env sanity |
| lib/auth | 8 | requireAdmin, requireVendor, getAuthUser |
| lib/cloudinary | 3 | upload helper |
| lib/prisma | 2 | singleton behaviour |
| api/register | 4 | registration endpoint, validation, duplicate email |
| api/upload | 3 | Cloudinary endpoint, auth guards |
| admin/actions | 12 | 5 admin Server Actions — auth, enum validation, DB calls |
| store/actions | 11 | 5 vendor Server Actions — auth, ownership enforcement |

---

## Build Roadmap

| Phase | Scope | Status |
|-------|-------|--------|
| 0 | Auth migration — Clerk → Auth.js v5 + Prisma adapter | Complete |
| 1 | Foundation — PostgreSQL, Prisma 7, Cloudinary, middleware | Complete |
| 2 | Admin Panel — TailAdmin UI + 6 pages + Server Actions | Complete |
| 3 | Vendor Dashboard — 5 pages + Cloudinary upload + Server Actions | Complete |
| 4 | Public Storefront — wire existing pages to real Prisma data | In progress |
| 5 | Platform Services — coupon engine, product ratings | Planned |

---

## Engineering Decisions

**Server Actions over REST for admin/vendor mutations.**
Keeps auth checks co-located with the mutation, eliminates a client/server serialization layer, and lets `revalidatePath` handle cache invalidation without a separate fetch. The pattern is consistent across both role zones: Server Component fetches → Server Action mutates → path revalidated.

**Auth.js v5 over a managed auth service.**
Full ownership of the token shape and session callbacks, no third-party dependency, and clean self-hosting. JWT strategy avoids a session-table lookup on every request. Credentials + Google in a single config keeps onboarding flexible without managing two separate auth systems.

**Prisma 7 driver adapter (`@prisma/adapter-pg`).**
The Prisma 7 mandated pattern for direct PostgreSQL connections. The generated client lives at `prisma/generated/prisma/` — outside `node_modules` — making artefacts explicit, auditable, and version-controlled.

**PostgreSQL over a managed database service.**
Direct connection keeps the local dev loop fast and removes a managed-DB dependency. The same schema deploys unchanged to any VPS Postgres instance, or migrates to RDS/Supabase with a connection string swap.

**COD-only payments for now.**
Stripe is not available in all target markets. The schema carries a `PaymentMethod` enum (`COD | STRIPE`) so the integration can be added in a future phase without a breaking migration.

**TailAdmin components copied-in, not installed as a package.**
Allows targeted per-component modifications without fighting an upstream update cycle. Both the admin and vendor zones share a common primitive layer (`components/admin/ui/`) so changes propagate to both surfaces.

---

## Contributing

Pull requests are welcome. Please open an issue first to discuss substantial changes. See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

---

## License

MIT — see [LICENSE.md](./LICENSE.md).
