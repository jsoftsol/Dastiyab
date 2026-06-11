# GoCart — Vendor Dashboard Design Spec (Phase 3)

**Date:** 2026-06-12
**Status:** Approved
**Phase:** 3 — Vendor Dashboard

---

## 1. Goal

Wire the existing vendor dashboard UI to real PostgreSQL data using Next.js 16 best practices. All 4 existing pages currently fetch from `assets/assets.js` dummy data; this phase replaces those with direct Prisma reads in async server components and Server Actions for mutations. One new page (Edit Product) is added. The Cloudinary image upload API route is created. All routes are scoped to the authenticated vendor's own store.

---

## 2. Architecture

Every vendor page follows the same three-layer pattern established in Phase 2:

```
app/store/[page]/page.jsx           ← async server component — fetches via Prisma, renders layout
app/store/[page]/[Page]Client.jsx   ← 'use client' — interactive state only (forms, toggles, modals)
app/store/actions.js                ← 'use server' — all vendor mutations (one file)
app/api/upload/route.js             ← API route — Cloudinary image upload
```

**Reads:** `page.jsx` calls Prisma directly. Data arrives server-side before the page renders — no `useEffect`, no client-side fetch.

**Mutations:** Client components call Server Actions imported from `app/store/actions.js`. Each action ends with `revalidatePath` so the server component re-fetches fresh data without a manual reload.

**Image upload:** Client components POST files to `/api/upload` one at a time, collect the returned Cloudinary URLs, then include those URLs in the product create/update server action call. The server actions only store strings — they never handle raw file data.

**Loading feedback:** Client components use `useTransition` to track pending state. `react-hot-toast` for success/error messages. Actions return `{ error: string }` on failure.

**Auth:** `requireVendor()` from `lib/auth.js` in every server action. `storeId` is always derived from session (`prisma.store.findUnique({ where: { userId } })`) — never accepted from the request body.

**Ownership enforcement:** Before any product or order mutation, the action verifies the resource belongs to the vendor's store. Returns `{ error: 'Forbidden' }` if not.

---

## 3. Pages

| Page | Route | Prisma read (in page.jsx) | Mutations |
|------|-------|--------------------------|-----------|
| Dashboard | `/store` | products count, earnings aggregate, orders count, ratings count, recent ratings with product+user relations — all filtered by `storeId` | none |
| Add Product | `/store/add-product` | none (form only) | `createProduct` |
| Manage Products | `/store/manage-product` | all products where `storeId` matches vendor | `toggleInStock`, `deleteProduct` |
| Edit Product | `/store/edit-product/[id]` | single product by ID (verified to belong to vendor's store) | `updateProduct` |
| Orders | `/store/orders` | all orders where `storeId` matches vendor, include `user`, `orderItems` with `product`, `address` | `updateOrderStatus` |

### Dashboard Prisma queries

```js
const store = await prisma.store.findUnique({ where: { userId } })
const storeId = store.id

const [productCount, earningsAgg, orderCount, ratingCount, recentRatings] = await Promise.all([
  prisma.product.count({ where: { storeId } }),
  prisma.order.aggregate({ where: { storeId }, _sum: { total: true } }),
  prisma.order.count({ where: { storeId } }),
  prisma.rating.count({ where: { product: { storeId } } }),
  prisma.rating.findMany({
    where: { product: { storeId } },
    include: { product: true, user: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
  }),
])
```

---

## 4. Server Actions (`app/store/actions.js`)

All functions are `'use server'`. Each calls `requireVendor()` first and returns `{ error: string }` on failure. `storeId` is always derived from session, never from arguments.

```
createProduct(productData)          prisma.product.create   → revalidatePath('/store/manage-product')
updateProduct(productId, data)      prisma.product.update   → revalidatePath('/store/manage-product')
deleteProduct(productId)            prisma.product.delete   → revalidatePath('/store/manage-product')
toggleInStock(productId, inStock)   prisma.product.update   → revalidatePath('/store/manage-product')
updateOrderStatus(orderId, status)  prisma.order.update     → revalidatePath('/store/orders')
```

**`createProduct(productData)`**
Receives: `{ name, description, mrp, price, category, images: string[] }`. Parses `mrp` and `price` to Float. Creates product with `storeId` from session.

**`updateProduct(productId, data)`**
Fetches product first — returns `{ error: 'Forbidden' }` if `product.storeId !== vendor.storeId`. Updates with provided fields. After save the `EditProductClient` calls `router.push('/store/manage-product')` to navigate away, so only `/store/manage-product` needs revalidation.

**`deleteProduct(productId)`**
Ownership check then `prisma.product.delete`. Returns `{ error: 'Forbidden' }` if not owned by vendor.

**`toggleInStock(productId, inStock)`**
Ownership check then `prisma.product.update({ data: { inStock } })`.

**`updateOrderStatus(orderId, status)`**
Validates `status` against `VALID_ORDER_STATUSES = ['ORDER_PLACED', 'PROCESSING', 'SHIPPED', 'DELIVERED']`. Fetches order — returns `{ error: 'Forbidden' }` if `order.storeId !== vendor.storeId`. Then updates.

---

## 5. Upload API Route

**`app/api/upload/route.js`**

`POST` handler. Auth check via `requireVendor()` or `requireAdmin()` — returns 401 if neither. Reads file from `multipart/form-data` (`request.formData()`, field name `file`). Converts to buffer, uploads to Cloudinary via `cloudinary.uploader.upload(dataURI, { folder: 'gocart' })`. Returns `{ url: string }` on success, `{ error: string }` on failure.

---

## 6. Client Components

| File | Purpose |
|------|---------|
| `app/store/add-product/AddProductClient.jsx` | Product creation form — 4 image slots each POSTing to `/api/upload`, calls `createProduct` |
| `app/store/manage-product/ManageProductClient.jsx` | Toggle in-stock + delete per product row, Edit navigates to `/store/edit-product/[id]` |
| `app/store/edit-product/[id]/EditProductClient.jsx` | Pre-populated product form — same fields as add, handles image replacement, calls `updateProduct` |
| `app/store/orders/OrdersClient.jsx` | Status select dropdown per order row + order detail modal, calls `updateOrderStatus` |

Dashboard (`/store`) and Add Product wrapper (`/store/add-product/page.jsx`) are the only pages without a server-fetched data requirement in the page — Add Product's page.jsx is a thin wrapper that just renders `AddProductClient`.

---

## 7. StoreLayout Auth Wiring

`components/store/StoreLayout.jsx` currently hardcodes `isSeller = true` with dummy store data. Replace with:

```js
const user = await getAuthUser()
if (!user) redirect('/sign-in')
const store = await prisma.store.findUnique({ where: { userId: user.userId } })
if (!store) render "not authorized" message
```

Pass real store data (`name`, `logo`) to `StoreSidebar` props.

---

## 8. New Files

```
app/store/actions.js
app/store/edit-product/[id]/page.jsx
app/store/edit-product/[id]/EditProductClient.jsx
app/store/add-product/AddProductClient.jsx
app/store/manage-product/ManageProductClient.jsx
app/store/orders/OrdersClient.jsx
app/api/upload/route.js
```

## Modified Files

```
app/store/page.jsx                      convert to async server component
app/store/add-product/page.jsx          thin server wrapper rendering AddProductClient
app/store/manage-product/page.jsx       convert to async server component, render ManageProductClient
app/store/orders/page.jsx               convert to async server component, render OrdersClient
components/store/StoreLayout.jsx        wire real auth + store lookup
```

## Untouched

```
components/store/StoreNavbar.jsx
components/store/StoreSidebar.jsx
app/store/layout.jsx
lib/auth.js
middleware.js
auth.js
lib/cloudinary.js
```

---

## 9. Testing

**`__tests__/store/actions.test.js`** — ~14 tests

| Action | Tests |
|--------|-------|
| `createProduct` | unauthorized, happy path |
| `updateProduct` | unauthorized, forbidden (wrong store), happy path |
| `deleteProduct` | unauthorized, forbidden, happy path |
| `toggleInStock` | unauthorized, forbidden, happy path |
| `updateOrderStatus` | unauthorized, forbidden, invalid status, happy path |

Mocks: `vi.mock('@/lib/auth')`, `vi.mock('@/lib/prisma')` (default export), `next/cache`.

**`__tests__/api/upload.test.js`** — ~2 tests

- Unauthorized (no session) → 401
- Happy path — mock `cloudinary.uploader.upload`, verify `{ url }` returned

Mocks: `vi.mock('@/lib/auth')`, `vi.mock('cloudinary', () => ({ v2: { config: vi.fn(), uploader: { upload: vi.fn() } } }))`.

Total new: ~16 tests → suite grows from 27 to ~43.

---

## 10. Constraints

- `storeId` is always derived from session — never accepted from any request body or server action argument
- Ownership check on every product/order mutation before any DB write
- `lib/prisma.js` singleton used throughout — never `new PrismaClient()`
- All actions call `requireVendor()` before any DB operation
- COD only — no payment logic
- No shared UI primitives extracted — inline Tailwind styling kept as-is
- Prisma 7: after schema changes run `npx prisma generate` then `npx prisma db push` (no schema changes needed for Phase 3)
