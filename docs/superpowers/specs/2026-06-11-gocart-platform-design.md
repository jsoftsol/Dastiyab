# GoCart Platform — Design Spec

**Date:** 2026-06-11  
**Status:** Approved  
**Vision:** Multi-vendor e-commerce platform (Shopify-like, long-term)

---

## 1. Platform Overview

GoCart is a multi-vendor e-commerce marketplace where:
- **Vendors** create and manage their own stores, products, and orders
- **Customers** browse, add to cart, and place COD orders
- **Admins** oversee the entire platform — approve stores, manage coupons, monitor orders and users

Built on the existing GoCart Next.js 15 codebase. All 3 zones (admin, vendor dashboard, public storefront) are wired to a real PostgreSQL database with Clerk authentication.

---

## 2. Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | Next.js 15.3.5 (Turbopack), React 19 | existing |
| Styling | Tailwind CSS v4 | existing |
| Admin + Vendor UI | TailAdmin free Next.js template | components copied into project |
| Customer UI | Existing GoCart styling | evolved separately |
| Auth | Clerk (`@clerk/nextjs`) | 3 roles: `admin`, `vendor`, `customer` |
| ORM | Prisma (standard PostgreSQL driver) | remove `driverAdapters` preview feature |
| Database | PostgreSQL | local via Docker for dev, VPS in production |
| Image Storage | Cloudinary | product images + store logos |
| Payments | COD only | `PaymentMethod.COD` — Stripe deferred |
| State Management | Redux Toolkit | existing cart, product, address, rating slices |

---

## 3. Build Phases

Each phase is independently shippable. Build in order — each depends on the previous.

| Phase | Sub-project | Depends on |
|-------|------------|-----------|
| 1 | **Foundation** — Clerk auth, PostgreSQL + Prisma, Cloudinary config, middleware | — |
| 2 | **Admin Panel** — TailAdmin UI + all admin API routes | Phase 1 |
| 3 | **Vendor Dashboard** — TailAdmin UI + vendor API routes | Phase 1 |
| 4 | **Public Storefront** — customer pages wired to real data | Phases 1–3 |
| 5 | **Platform Services** — Cloudinary uploads, coupon engine, ratings | Phases 1–4 |

---

## 4. Route Protection

`middleware.ts` at repo root uses `clerkMiddleware()`:

| Route pattern | Requirement |
|--------------|------------|
| `/admin/*` | `role === 'admin'` — non-admins redirected to `/` |
| `/store/*` | `role === 'vendor'` — non-vendors redirected to `/` |
| `/api/admin/*` | `role === 'admin'` — returns `403` otherwise |
| `/api/store/*` | `role === 'vendor'` — returns `403` otherwise |
| `/orders`, `/cart` (checkout) | authenticated user (any role) |
| All other routes | public |

---

## 5. Admin Panel (Phase 2)

### UI Components (TailAdmin-based)

**Shell — replace existing:**
- `components/admin/AdminLayout.jsx`
- `components/admin/AdminSidebar.jsx` — 6 nav links
- `components/admin/AdminNavbar.jsx` — Clerk `<UserButton />`

**Shared UI primitives (new):**
- `components/admin/ui/StatCard.jsx`
- `components/admin/ui/DataTable.jsx`
- `components/admin/ui/Badge.jsx`
- `components/admin/ui/PageHeader.jsx`

### Pages

| Page | Route | Functionality |
|------|-------|--------------|
| Dashboard | `/admin` | Stats (products, revenue, orders, stores) + orders area chart |
| Stores | `/admin/stores` | All approved stores, toggle active/inactive |
| Approve Store | `/admin/approve` | Pending applications, approve/reject |
| Coupons | `/admin/coupons` | Create coupons, list with delete |
| Orders | `/admin/orders` | All orders across all stores, update status |
| Users | `/admin/users` | All registered users — view only |

**New files needed:** `app/admin/orders/page.jsx`, `app/admin/users/page.jsx`

### API Routes

| Route | Methods | Prisma models |
|-------|---------|--------------|
| `/api/admin/dashboard` | `GET` | Product, Order, Store |
| `/api/admin/stores` | `GET`, `PATCH` | Store (toggle `isActive`) |
| `/api/admin/stores/approve` | `GET`, `PATCH` | Store (set `status`) |
| `/api/admin/coupons` | `GET`, `POST`, `DELETE` | Coupon |
| `/api/admin/orders` | `GET`, `PATCH` | Order, OrderItem, Store, User |
| `/api/admin/users` | `GET` | User, Store |

---

## 6. Vendor Dashboard (Phase 3)

### UI Components (TailAdmin-based)

**Shell — replace existing:**
- `components/store/StoreLayout.jsx`
- `components/store/StoreSidebar.jsx` — 4 nav links
- `components/store/StoreNavbar.jsx` — Clerk `<UserButton />`

**Reuses admin UI primitives:** `StatCard`, `DataTable`, `Badge`, `PageHeader`

### Pages

| Page | Route | Functionality |
|------|-------|--------------|
| Dashboard | `/store` | Store stats (products, revenue, orders) + revenue chart |
| Add Product | `/store/add-product` | Form with Cloudinary multi-image upload |
| Manage Products | `/store/manage-product` | Product list, edit, toggle in-stock, delete |
| Orders | `/store/orders` | Store's orders only, update order status |

### API Routes

All routes scoped to the authenticated vendor's store only.

| Route | Methods | Prisma models |
|-------|---------|--------------|
| `/api/store/dashboard` | `GET` | Product, Order (vendor's store) |
| `/api/store/products` | `GET`, `POST`, `PATCH`, `DELETE` | Product |
| `/api/store/orders` | `GET`, `PATCH` | Order, OrderItem |

---

## 7. Public Storefront (Phase 4)

Existing pages — no UI redesign. Dummy data calls replaced with real API fetches.

| Page | Route | API |
|------|-------|-----|
| Home | `/` | `/api/public/products?featured=true` |
| Shop | `/shop` | `/api/public/products` (filter + search) |
| Store Shop | `/shop/[username]` | `/api/public/stores/[username]/products` |
| Product | `/product/[productId]` | `/api/public/products/[id]` |
| Cart | `/cart` | Redux (client-side) |
| Orders/Checkout | `/orders` | `/api/public/orders` (GET + POST) |
| Create Store | `/create-store` | `/api/public/stores` (POST — creates store, assigns vendor role) |
| Pricing | `/pricing` | static |

---

## 8. Shared Services (Phase 5)

| Service | Route | Details |
|---------|-------|---------|
| Image upload | `POST /api/upload` | Accepts file, uploads to Cloudinary, returns URL. Used by add-product and create-store |
| Coupon validation | `POST /api/public/coupons/validate` | Checks code, expiry, `forNewUser`, `forMember` |
| Ratings | `POST /api/public/ratings` | Only allowed if user has a DELIVERED order for the product |
| Prisma client | `lib/prisma.js` | Single shared instance across all API routes |

---

## 9. Authentication

### Clerk Setup
- Install `@clerk/nextjs`
- Wrap `app/layout.jsx` with `<ClerkProvider>`
- `middleware.ts` at repo root handles all route protection

### Roles
| Role | How assigned |
|------|-------------|
| `admin` | Manually via Clerk dashboard — `publicMetadata: { role: "admin" }` |
| `vendor` | Automatically on store creation — set via Clerk backend API |
| `customer` | Default — no explicit role needed |

### Sign-in page
- Route: `app/sign-in/[[...sign-in]]/page.jsx`
- Uses Clerk `<SignIn />` component
- Post sign-in redirect based on role: admin → `/admin`, vendor → `/store`, customer → `/`

---

## 10. Prisma Configuration Changes

Remove `driverAdapters` preview feature and `directUrl`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

No schema model changes required for Phases 1–4.

---

## 11. Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/gocart

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/

# Cloudinary
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

---

## 12. Out of Scope (Deferred)

- Stripe / online payments
- Email notifications
- Vendor analytics beyond basic stats
- Multi-currency support
- VPS deployment configuration
- Mobile app
