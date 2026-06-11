# GoCart — Admin Panel Design Spec (Phase 2)

**Date:** 2026-06-12
**Status:** Approved
**Phase:** 2 — Admin Panel

---

## 1. Goal

Wire the existing admin panel UI to real PostgreSQL data using Next.js 16 best practices. All 4 existing pages currently fetch from `assets/assets.js` dummy data; this phase replaces those with direct Prisma reads in async server components and Server Actions for mutations. Two new pages (Orders, Users) are added. Zero API routes are created for the admin panel.

---

## 2. Architecture

Every admin page follows the same three-layer pattern:

```
app/admin/[page]/page.jsx          ← async server component — fetches via Prisma, renders layout
app/admin/[page]/[Page]Client.jsx  ← 'use client' — interactive state only (toggles, forms, dropdowns)
app/admin/actions.js               ← 'use server' — all admin mutations (one file)
```

**Reads:** `page.jsx` calls Prisma directly. Data arrives server-side before the page renders — no `useEffect`, no client-side fetch.

**Mutations:** Client components call Server Actions imported from `app/admin/actions.js`. Each action ends with `revalidatePath` so the server component re-fetches fresh data without a manual reload.

**Loading feedback:** Client components use `useTransition` to track pending state (disabled buttons/spinner). `react-hot-toast` remains for success/error messages — actions return `{ error: string }` on failure, client checks and calls `toast.error()` if present.

**No API routes** are created for the admin panel. Existing `/api/auth/*` routes are untouched.

---

## 3. Pages

| Page | Route | Prisma read (in page.jsx) | Mutations |
|------|-------|--------------------------|-----------|
| Dashboard | `/admin` | product count, order aggregate (revenue + count), approved store count, all orders (createdAt + total for chart) | none |
| Stores | `/admin/stores` | all stores where `status = 'approved'`, include `user` | `toggleStoreActive` |
| Approve Store | `/admin/approve` | all stores where `status = 'pending'`, include `user` | `approveStore` |
| Coupons | `/admin/coupons` | all coupons ordered by `createdAt desc` | `createCoupon`, `deleteCoupon` |
| Orders | `/admin/orders` | all orders, include `user`, `store`, `orderItems` with `product` | `updateOrderStatus` |
| Users | `/admin/users` | all users, include `store` (for vendor badge) | none |

### Dashboard Prisma query

```js
const [productCount, revenueAgg, orderCount, storeCount, allOrders] = await Promise.all([
  prisma.product.count(),
  prisma.order.aggregate({ _sum: { total: true } }),
  prisma.order.count(),
  prisma.store.count({ where: { status: 'approved' } }),
  prisma.order.findMany({ select: { createdAt: true, total: true } }),
])
```

Revenue value: `revenueAgg._sum.total ?? 0`

---

## 4. Server Actions (`app/admin/actions.js`)

All functions are `'use server'`. Each calls `requireAdmin()` from `lib/auth.js` first and returns `{ error: string }` on failure.

```
toggleStoreActive(storeId, isActive)     prisma.store.update  →  revalidatePath('/admin/stores')
approveStore(storeId, status)            prisma.store.update  →  revalidatePath('/admin/approve')
createCoupon(couponData)                 prisma.coupon.create →  revalidatePath('/admin/coupons')
deleteCoupon(code)                       prisma.coupon.delete →  revalidatePath('/admin/coupons')
updateOrderStatus(orderId, status)       prisma.order.update  →  revalidatePath('/admin/orders')
```

`approveStore` accepts `status: 'approved' | 'rejected'`. When approving, also sets `isActive: true`.

`createCoupon` receives a plain object with fields: `code`, `description`, `discount` (parsed to Float), `expiresAt` (parsed to Date), `forNewUser` (boolean), `forMember` (boolean), `isPublic` (boolean). The `CouponsClient` component manages form state and passes this object directly — no native FormData.

---

## 5. Client Components

| File | Purpose |
|------|---------|
| `app/admin/stores/StoresClient.jsx` | Active toggle per store row — calls `toggleStoreActive` |
| `app/admin/approve/ApproveClient.jsx` | Approve / Reject buttons per store row — calls `approveStore` |
| `app/admin/coupons/CouponsClient.jsx` | Create coupon form + delete button — calls `createCoupon`, `deleteCoupon` |
| `app/admin/orders/OrdersClient.jsx` | Status `<select>` per order row — calls `updateOrderStatus` |

Dashboard (`/admin`) and Users (`/admin/users`) require no client component — fully server-rendered.

---

## 6. New Pages

### Orders (`app/admin/orders/page.jsx`)

Displays all orders across all stores. Columns: Order ID (truncated), Customer name, Store name, Items count, Total, Payment method, Status (editable via `OrdersClient`), Date placed.

### Users (`app/admin/users/page.jsx`)

Displays all registered users. Columns: Name, Email, Role (with vendor badge if `store` relation exists), Joined date. View only — no mutations.

---

## 7. Sidebar Update

`components/admin/AdminSidebar.jsx` — add two new links after Coupons:

```js
{ name: 'Orders',  href: '/admin/orders', icon: ShoppingCartIcon }
{ name: 'Users',   href: '/admin/users',  icon: UsersIcon }
```

---

## 8. File Changes

### New files
```
app/admin/actions.js
app/admin/orders/page.jsx
app/admin/orders/OrdersClient.jsx
app/admin/users/page.jsx
app/admin/stores/StoresClient.jsx
app/admin/approve/ApproveClient.jsx
app/admin/coupons/CouponsClient.jsx
```

### Modified files
```
app/admin/page.jsx                   convert to async server component
app/admin/stores/page.jsx            convert to async server component, render StoresClient
app/admin/approve/page.jsx           convert to async server component, render ApproveClient
app/admin/coupons/page.jsx           convert to async server component, render CouponsClient
components/admin/AdminSidebar.jsx    add Orders + Users links
```

### Untouched
```
app/admin/layout.jsx
components/admin/AdminLayout.jsx
components/admin/AdminNavbar.jsx
components/admin/StoreInfo.jsx
components/admin/ui/UserMenu.jsx
lib/auth.js
middleware.js
auth.js
```

---

## 9. Constraints

- `lib/prisma.js` singleton used in all server components and actions — never `new PrismaClient()`
- All actions call `requireAdmin()` before any DB operation — returns `{ error: 'Unauthorized' }` if check fails
- Vendor API routes remain out of scope — Phase 3
- No shared UI primitives (`StatCard`, `DataTable`, etc.) extracted in this phase — inline Tailwind styling kept as-is
- COD only — no payment logic
