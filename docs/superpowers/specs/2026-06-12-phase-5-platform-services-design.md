# Phase 5 — Platform Services Design

**Date:** 2026-06-12
**Status:** Approved
**Phase:** 5 of 5

---

## Overview

Phase 5 completes the platform by enforcing the coupon flag rules that exist in the schema but were never checked, and by adding computed rating aggregates to product API responses. No schema migrations are required.

**What was already done in earlier phases:**
- Cloudinary upload endpoint — Phase 3
- Basic coupon validation (expiry check) — Phase 4
- Product ratings POST (DELIVERED check, duplicate prevention) — Phase 4

**What this phase adds:**
1. Coupon flag enforcement (`forNewUser`, `forMember`, `isPublic`)
2. Ratings aggregation on product API responses (on-the-fly)

---

## 1. Coupon Engine Enhancements

### Affected routes
- `POST /api/public/coupons/validate`
- `POST /api/customer/orders`

### Flag semantics

| Flag | Meaning | Enforcement |
|------|---------|-------------|
| `isPublic: false` | Admin-distributed coupon — not for customer self-service | Reject always at validate |
| `forMember: true` | Any authenticated user (has an account) | Reject if no session |
| `forNewUser: true` | First-time buyer (zero previous orders) | Reject if user has ≥ 1 previous orders |

### Validate endpoint changes (`/api/public/coupons/validate`)

The endpoint reads the session via `getAuthUser()` — this does not throw when unauthenticated; it returns `null`. After the existing expiry check, three new guards run in order:

1. `isPublic === false` → `400 "This coupon is not available"`
2. `forMember === true` and no session → `400 "Sign in to use this coupon"`
3. `forNewUser === true` and no session → `400 "Sign in to use this coupon"` (can't verify order history without auth)
4. `forNewUser === true` and user has prior orders → query `prisma.order.count({ where: { userId } })` → `400 "This coupon is for new customers only"`

If all guards pass, the existing success response is returned unchanged.

### Order placement re-check (`/api/customer/orders` POST)

The same three flag checks run again inside the existing coupon validation block at order placement time. This is the security backstop — the user is always authenticated at this point, so all three flags can be enforced. If any flag fails, the order is rejected with a `400` before the `$transaction` begins.

---

## 2. Ratings Aggregation

### Affected routes
- `GET /api/public/products`
- `GET /api/public/products/[id]`

### Approach

On-the-fly computation — no schema changes, always accurate. After each Prisma query, two fields are computed from the `rating` array and added to each product object:

- `averageRating: number` — `ratings.length ? (sum / count)` rounded to one decimal, else `0`
- `ratingCount: number` — `ratings.length`

### Products list (`GET /api/public/products`)

The route already fetches `rating: { select: { rating: true } }`. The transform:
1. Computes `averageRating` and `ratingCount` for each product
2. Strips the raw `rating` array from the response (not needed on the listing page)

The existing `sort=ratingCount` continues to work — it uses Prisma's `_count` orderBy, not the computed field.

### Product detail (`GET /api/public/products/[id]`)

The route already fetches the full `rating` array with user info for review display. The transform:
1. Computes `averageRating` and `ratingCount` and adds them to the product object
2. Keeps the full `rating` array in the response (detail page renders individual reviews)

---

## 3. Testing

Four existing test files are updated — no new test files.

| Test file | New cases |
|-----------|-----------|
| `__tests__/api/coupons-validate.test.js` | `isPublic=false` rejected; `forMember=true` rejected when unauthenticated; `forNewUser=true` rejected when unauthenticated; `forNewUser=true` rejected when user has prior orders; `forNewUser=true` accepted when user has no prior orders |
| `__tests__/api/orders.test.js` | Same three flag checks enforced at order placement |
| `__tests__/api/products.test.js` | `averageRating` and `ratingCount` present; raw `rating` array absent from list response |
| `__tests__/api/products-id.test.js` | `averageRating` and `ratingCount` present alongside full `rating` array in detail response |

---

## Scope Boundaries

- No schema migrations
- No new routes
- No changes to the admin coupon creation UI (`forNewUser`, `forMember`, `isPublic` checkboxes already exist in `CouponsClient.jsx`)
- No changes to the `OrderSummary` component — it already calls the validate endpoint and handles error messages
- COD only — no payment changes
