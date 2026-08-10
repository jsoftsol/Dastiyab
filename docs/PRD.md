# GoCart — Product Requirements Document

**Date:** 2026-06-11 (last revised 2026-08-11)  
**Status:** Active  
**Vision:** A self-serve multi-vendor e-commerce marketplace (Shopify-like, long-term)

---

## Problem Statement

Merchants in Pakistan need a platform to sell online without building their own store from scratch. Buyers need a single marketplace to discover products from multiple vendors. GoCart solves both sides: vendors get a managed storefront, buyers get a unified shopping experience, and platform admins maintain oversight and trust.

---

## Target Users

### Vendors
Small to medium merchants who want to sell products online. They need to list products, manage inventory, and fulfill orders — without technical expertise.

### Customers
Online shoppers browsing and purchasing from multiple stores in one place. They expect a familiar e-commerce experience: browse → cart → checkout → order tracking.

### Platform Admin
The GoCart operator. Responsible for approving new stores, managing platform-wide coupons, monitoring orders, and maintaining marketplace integrity.

---

## Goals

- Enable any vendor to create a store and start selling within minutes
- Give customers a seamless multi-vendor shopping experience with COD checkout
- Give admins full visibility and control over the platform
- Build a foundation that can scale toward Stripe payments, mobile, and advanced analytics

---

## Features by Phase

### Phase 0 — Auth Migration
- Replaced Clerk with Auth.js v5 (`next-auth@beta`) + Prisma adapter, self-hosted, no third-party auth dependency
- Google OAuth + email/password (credentials) providers
- Custom sign-in page, JWT session strategy, role stored on `User.role`

### Phase 1 — Foundation
- Authentication with 3 roles: admin, vendor, customer (see Phase 0)
- PostgreSQL database with Prisma ORM
- Route protection middleware (admin and vendor zones locked)
- Cloudinary account configured for image uploads
- Environment setup and local Docker PostgreSQL

### Phase 2 — Admin Panel
- Dashboard with platform-wide stats (products, revenue, orders, stores) and orders chart
- Store management: view all stores, toggle active/inactive
- Store approvals: review and approve/reject pending store applications
- Coupon management: create, list, and delete discount coupons
- Orders overview: view all orders across all stores, update order status
- User management: view all registered users

### Phase 3 — Vendor Dashboard
- Store dashboard with store-specific stats and revenue chart
- Product management: add products with multi-image upload, edit, toggle in-stock, delete
- Order management: view store orders, update status (ORDER_PLACED → PROCESSING → SHIPPED → DELIVERED)

### Phase 4 — Public Storefront
- Home page with featured products and best sellers (real data)
- Shop page with product browsing, category filter, and search
- Per-store shop page (`/shop/[username]`)
- Product detail with images, description, ratings
- Cart (client-side Redux state)
- COD checkout with address selection and order placement
- Order history for logged-in customers
- Create Store onboarding flow for new vendors

### Phase 5 — Platform Services
- Cloudinary image upload endpoint (used by product forms and store creation)
- Coupon validation at checkout (expiry, new user, member flags)
- Product ratings (only after a DELIVERED order)

### Phase 6 — Deployment
- Multi-stage Dockerfile (Node 24 alpine, Next.js standalone output)
- `docker-compose.prod.yml` — postgres + app + one-shot migrate services
- GitHub Actions workflow: push to `deploy` branch → rsync → SSH → build & run
- **Note:** built after this PRD's original "Out of Scope" list was written (see below) — added because the team decided to self-host on a VPS rather than defer deployment past v1. Production is live at `https://dastiyab.jsoftsol.com/`, confirmed reachable and the deploy workflow green as of 2026-08-11.

---

## Non-Functional Requirements

- **Performance:** Pages load in under 2 seconds on a standard connection
- **Security:** All admin and vendor API routes protected server-side by role check
- **Data integrity:** Vendor API routes scoped to the vendor's own store — no cross-store data access
- **Scalability:** Prisma + PostgreSQL foundation can support future Stripe, analytics, and mobile features
- **Local dev:** Runs fully on local machine with Docker PostgreSQL — no cloud dependency for development

---

## Out of Scope (v1)

- Stripe or any online payment processing
- Email notifications (order confirmations, approval emails)
- Vendor analytics beyond basic stats
- Multi-currency support
- Mobile app
- Multi-language / i18n

> VPS/production deployment was originally listed here as out of scope, but was built anyway in a later session (see Phase 6 above) once the decision was made to self-host rather than defer it. Kept here as a note so the discrepancy isn't mysterious to a future reader.

---

## Success Criteria for v1

- A vendor can register, create a store, add products, and receive COD orders end-to-end
- A customer can browse products, add to cart, place a COD order, and view order history
- An admin can approve stores, manage coupons, and view all platform activity
- All routes are properly protected — no unauthorized access to admin or vendor data
