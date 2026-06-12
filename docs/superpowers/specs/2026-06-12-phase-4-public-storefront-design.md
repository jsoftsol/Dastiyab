# Phase 4 — Public Storefront Design

**Date:** 2026-06-12  
**Status:** Approved  
**Phase:** 4 of 5

---

## Overview

Phase 4 wires the existing public storefront pages to real PostgreSQL data via REST API routes. All mutations are mobile-app-ready from day one. The cart persists to the database so a future React Native app can sync the same cart seamlessly.

---

## Architecture

### Approach: API Routes + Client Components

All storefront data flows through REST endpoints:

- `GET /api/public/*` — unauthenticated read endpoints (products, stores, categories, coupon validation)
- `GET/POST/PUT/DELETE /api/customer/*` — auth-required endpoints (cart, addresses, orders, ratings)

Pages are client components that call these APIs. No Server Actions, no direct Prisma calls in page files. Every endpoint built for the web is immediately usable by the mobile app.

### Why not Server Components + Server Actions?

Server Actions are not callable from React Native — building them would mean duplicating all mutation logic as API routes later. API routes also make infinite scroll natural in client components.

---

## API Routes

### Public (unauthenticated)

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/api/public/products` | Paginated product list |
| `GET` | `/api/public/products/[id]` | Single product + ratings |
| `GET` | `/api/public/stores/[username]` | Store info + paginated products |
| `GET` | `/api/public/categories` | Distinct category list from DB |
| `POST` | `/api/public/stores` | Create store (existing route — wire form only) |
| `POST` | `/api/public/coupons/validate` | Validate coupon code, return discount |

### Customer (auth required)

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/api/customer/cart` | Fetch cart from `User.cart` JSON column |
| `PUT` | `/api/customer/cart` | Sync full cart to `User.cart` |
| `GET` | `/api/customer/addresses` | List user's saved addresses |
| `POST` | `/api/customer/addresses` | Save a new address |
| `DELETE` | `/api/customer/addresses/[id]` | Delete an address |
| `GET` | `/api/customer/orders` | User's order history |
| `POST` | `/api/customer/orders` | Place an order |
| `POST` | `/api/customer/ratings` | Submit a product rating |

### Query Parameters — `/api/public/products`

```
?page=1              — page number (default: 1)
?limit=12            — items per page (default: 12)
?search=term         — filter by product name (case-insensitive LIKE)
?category=name       — filter by category
?storeId=id          — filter by store (used internally by store shop page)
?sort=createdAt      — sort by newest (default)
?sort=ratingCount    — sort by most rated (used by Best Selling section)
```

Response shape:
```json
{
  "products": [...],
  "total": 120,
  "page": 1,
  "totalPages": 10
}
```

---

## Pages

### Home (`/`)

- Client component
- Fetches from `/api/public/products`:
  - Latest Products: `?limit=4&sort=createdAt`
  - Best Selling: `?limit=8&sort=ratingCount`
- Fetches categories from `/api/public/categories` for `CategoriesMarquee`
- Replaces Redux `productDummyData` initial state

### Shop (`/shop`)

- Client component with infinite scroll
- Fetches page 1 on mount from `/api/public/products`
- URL params `?search=&category=` forwarded to the API
- `IntersectionObserver` on a sentinel div at the bottom auto-loads the next page
- "Load More" button below the grid as a manual fallback (fires the same fetch)
- Appends new products to existing list; hides button/observer when `page >= totalPages`

### Store Shop (`/shop/[username]`)

- Client component
- Fetches store metadata + first page of products from `/api/public/stores/[username]`
- Same infinite scroll pattern as Shop
- Shows inline "Store not found" message if store is not found, not approved, or not active — no redirect

### Product Detail (`/product/[productId]`)

- Client component
- Fetches from `/api/public/products/[id]` — returns product with all ratings and store info
- "Add to Cart": dispatches Redux `addToCart` immediately (for instant badge update), then calls `PUT /api/customer/cart` in background to sync DB
- Unauthenticated users: cart stays in Redux only; syncs to DB on login

### Orders (`/orders`)

- Auth-guarded client component (middleware already enforces this)
- Fetches from `/api/customer/orders` — returns orders with items, products, address
- Rating button: opens `RatingModal`, submits to `POST /api/customer/ratings`
- Rating button disabled after rating submitted, or if order status is not `DELIVERED`

### Create Store (`/create-store`)

- Client component — wires existing form UI to `POST /api/public/stores` (route already exists)
- Logo upload: calls `/api/upload` first, uses returned `secure_url` in store payload
- On success: calls `signOut({ callbackUrl: '/sign-in' })` so the new `vendor` role is picked up on next login
- Redirects to sign-in with a success message

---

## Cart Persistence

### Strategy: Redux + DB dual-write

`User.cart` (existing JSON column) is the server source of truth. Redux is the client cache for instant UI.

**Guest users:**
- Cart lives in Redux only
- On login, client merges local Redux cart with server cart from `GET /api/customer/cart`, then syncs via `PUT /api/customer/cart`
- Merge rule: if same product exists in both, take the higher quantity

**Logged-in users:**
- Every add/remove dispatches a Redux action (synchronous, instant UI update)
- Immediately fires `PUT /api/customer/cart` with the full updated cart (fire-and-forget — UI is never blocked)

**App init:**
- `GET /api/customer/cart` called on mount in the root layout or a cart-init component
- If logged in: replaces Redux cart with DB cart
- If not logged in: 200 with `{ cart: {} }` — no error

**Cart format in DB (`User.cart` JSON):**
```json
{ "productId1": 2, "productId2": 1 }
```
Same shape as the existing Redux `cartItems` object — no transformation needed.

---

## Checkout Flow

Triggered from `OrderSummary` component on the cart page.

1. **Addresses** — `GET /api/customer/addresses` populates the address dropdown on mount. "Add Address" modal posts to `POST /api/customer/addresses` and re-fetches the list.

2. **Coupon** — "Apply" button calls `POST /api/public/coupons/validate` with `{ code }`. Returns `{ discount, description }` on success. Discount applied client-side to the displayed total. Coupon code stored in component state for submission.

3. **Place Order** — `POST /api/customer/orders` with:
   ```json
   {
     "addressId": "...",
     "couponCode": "NEW20",
     "items": [{ "productId": "...", "quantity": 2 }]
   }
   ```
   Server-side the route:
   - Re-fetches prices from DB (never trusts client prices)
   - Re-validates coupon expiry and eligibility
   - Checks `inStock` on each product
   - Creates `Order` + `OrderItem` records
   - Clears `User.cart` in the same transaction
   - Returns the created order

4. **On success** — Redux cart cleared, user redirected to `/orders`

5. **COD only** — no payment step. Order status starts as `ORDER_PLACED`.

---

## Error Handling

### Auth guards
- `/api/customer/*` routes call `getAuthUser()` from `lib/auth.js`, return `401` if no session
- `GET /api/customer/cart` returns `{ items: [] }` for unauthenticated requests (graceful degradation)

### Page-level errors
- Product/store not found → inline "not found" message, no redirect
- Store not approved or not active → inline message on `/shop/[username]`
- Orders page with no orders → empty state UI

### API errors
- All routes return `{ error: string }` with appropriate HTTP status — consistent with admin/vendor convention
- Client components show toast notifications for all mutation failures

### Order placement edge cases
- Out-of-stock product → `400` with product name in error message
- Coupon expired at order time → `400` (re-validated server-side even if client already validated)
- Price mismatch → server uses DB prices; order total is authoritative (acceptable for COD)

### Rating guards
`POST /api/customer/ratings` enforces:
- Order must exist and belong to the requesting user
- Order status must be `DELIVERED`
- No existing rating for `(userId, productId, orderId)` — enforced by unique constraint in schema

---

## Testing

Target: ~30 new tests, bringing total from 45 to ~75. All tests use Vitest, following existing patterns.

| File | Coverage |
|------|----------|
| `__tests__/api/public/products.test.js` | Pagination, search filter, category filter, empty results |
| `__tests__/api/public/stores.test.js` | Lookup by username, not found, inactive store |
| `__tests__/api/public/coupons.test.js` | Valid coupon, expired, non-existent code, case insensitivity |
| `__tests__/api/customer/cart.test.js` | GET empty for guest, PUT syncs items, auth guard |
| `__tests__/api/customer/addresses.test.js` | GET/POST/DELETE, auth guard |
| `__tests__/api/customer/orders.test.js` | Place order (price revalidation, stock check, coupon revalidation), GET history, auth guard |
| `__tests__/api/customer/ratings.test.js` | Submit rating, duplicate guard, non-delivered order guard |

No tests for React page components — consistent with existing approach.

---

## Key Constraints (inherited from CLAUDE.md)

- COD only — no Stripe code
- `lib/prisma.js` singleton — never `new PrismaClient()` in a route handler
- All customer routes derive `userId` from session — never accept it from request body
- Return `{ error: string }` with appropriate HTTP status on failure
- Shared UI primitives stay in `components/admin/ui/` — storefront components stay in `components/(public)/` or `components/`
