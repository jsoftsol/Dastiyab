# Phase 3 — Vendor Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire all 4 vendor dashboard pages to real PostgreSQL data, add a Cloudinary image upload API route, and create a new Edit Product page — replacing all `assets/assets.js` dummy data with async server components + Server Actions.

**Architecture:** Every page follows the same three-layer pattern from Phase 2: `page.jsx` is an async server component that reads from Prisma; `*Client.jsx` is a `'use client'` component for interactive parts; `app/store/actions.js` is the sole mutation layer. The `app/api/upload/route.js` handles Cloudinary image uploads separately. All mutations derive `storeId` from the authenticated session — never from arguments. Ownership is enforced per-action before any DB write.

**Tech Stack:** Next.js 16 App Router, Prisma 7 (`lib/prisma.js` singleton), Auth.js v5 (`lib/auth.js`), Cloudinary (`lib/cloudinary.js`), react-hot-toast, useTransition, Vitest

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `app/store/actions.js` | Create | All 5 vendor Server Actions (createProduct, updateProduct, deleteProduct, toggleInStock, updateOrderStatus) |
| `app/api/upload/route.js` | Create | POST handler — receive file, upload to Cloudinary, return URL |
| `components/store/StoreLayout.jsx` | Modify | Remove `'use client'`, make async, wire real auth + store lookup |
| `app/store/page.jsx` | Modify | Convert to async server component — 4 stat cards + recent reviews |
| `app/store/add-product/page.jsx` | Modify | Thin server wrapper rendering AddProductClient |
| `app/store/add-product/AddProductClient.jsx` | Create | Create product form — 4 image slots with upload, calls createProduct |
| `app/store/manage-product/page.jsx` | Modify | Async server component — fetch vendor's products, render ManageProductClient |
| `app/store/manage-product/ManageProductClient.jsx` | Create | Product table with toggle in-stock, delete, edit link |
| `app/store/edit-product/[id]/page.jsx` | Create | Async server component — fetch product (verify ownership), render EditProductClient |
| `app/store/edit-product/[id]/EditProductClient.jsx` | Create | Pre-populated product form with image management, calls updateProduct |
| `app/store/orders/page.jsx` | Modify | Async server component — fetch store orders with relations, render OrdersClient |
| `app/store/orders/OrdersClient.jsx` | Create | Orders table with status dropdown + order detail modal |
| `__tests__/store/actions.test.js` | Create | 15 unit tests for all 5 server actions |
| `__tests__/api/upload.test.js` | Create | 3 unit tests for upload route |

---

## Task 1: Server Actions (`app/store/actions.js`) + Tests

**Files:**
- Create: `app/store/actions.js`
- Create: `__tests__/store/actions.test.js`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/store/actions.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  requireVendor: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    store: { findUnique: vi.fn() },
    product: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    order: { findUnique: vi.fn(), update: vi.fn() },
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { requireVendor } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import {
  createProduct,
  updateProduct,
  deleteProduct,
  toggleInStock,
  updateOrderStatus,
} from '@/app/store/actions'

const VENDOR = { userId: 'user_1', role: 'vendor' }
const STORE = { id: 'store_1', userId: 'user_1' }
const PRODUCT = { id: 'prod_1', storeId: 'store_1', name: 'Test', description: 'Desc', mrp: 100, price: 80, images: [], category: 'Electronics', inStock: true }
const ORDER = { id: 'order_1', storeId: 'store_1', status: 'ORDER_PLACED' }

beforeEach(() => vi.clearAllMocks())

describe('createProduct', () => {
  it('returns error when not vendor', async () => {
    requireVendor.mockResolvedValue(null)
    const result = await createProduct({ name: 'x', description: 'x', mrp: '10', price: '8', category: 'Electronics', images: [] })
    expect(result).toEqual({ error: 'Unauthorized' })
    expect(prisma.product.create).not.toHaveBeenCalled()
  })

  it('creates product with storeId from session and revalidates', async () => {
    requireVendor.mockResolvedValue(VENDOR)
    prisma.store.findUnique.mockResolvedValue(STORE)
    await createProduct({ name: 'Shoe', description: 'Nice shoe', mrp: '100', price: '80', category: 'Clothing', images: ['https://url.com/img.jpg'] })
    expect(prisma.product.create).toHaveBeenCalledWith({
      data: {
        name: 'Shoe',
        description: 'Nice shoe',
        mrp: 100,
        price: 80,
        category: 'Clothing',
        images: ['https://url.com/img.jpg'],
        storeId: 'store_1',
      },
    })
    expect(revalidatePath).toHaveBeenCalledWith('/store/manage-product')
  })
})

describe('updateProduct', () => {
  it('returns error when not vendor', async () => {
    requireVendor.mockResolvedValue(null)
    expect(await updateProduct('prod_1', {})).toEqual({ error: 'Unauthorized' })
  })

  it('returns Forbidden when product belongs to different store', async () => {
    requireVendor.mockResolvedValue(VENDOR)
    prisma.store.findUnique.mockResolvedValue(STORE)
    prisma.product.findUnique.mockResolvedValue({ ...PRODUCT, storeId: 'other_store' })
    expect(await updateProduct('prod_1', {})).toEqual({ error: 'Forbidden' })
    expect(prisma.product.update).not.toHaveBeenCalled()
  })

  it('updates product and revalidates', async () => {
    requireVendor.mockResolvedValue(VENDOR)
    prisma.store.findUnique.mockResolvedValue(STORE)
    prisma.product.findUnique.mockResolvedValue(PRODUCT)
    await updateProduct('prod_1', { name: 'New', description: 'New desc', mrp: '120', price: '90', category: 'Electronics', images: ['https://url.com/new.jpg'] })
    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: 'prod_1' },
      data: { name: 'New', description: 'New desc', mrp: 120, price: 90, category: 'Electronics', images: ['https://url.com/new.jpg'] },
    })
    expect(revalidatePath).toHaveBeenCalledWith('/store/manage-product')
  })
})

describe('deleteProduct', () => {
  it('returns error when not vendor', async () => {
    requireVendor.mockResolvedValue(null)
    expect(await deleteProduct('prod_1')).toEqual({ error: 'Unauthorized' })
  })

  it('returns Forbidden when product belongs to different store', async () => {
    requireVendor.mockResolvedValue(VENDOR)
    prisma.store.findUnique.mockResolvedValue(STORE)
    prisma.product.findUnique.mockResolvedValue({ ...PRODUCT, storeId: 'other_store' })
    expect(await deleteProduct('prod_1')).toEqual({ error: 'Forbidden' })
    expect(prisma.product.delete).not.toHaveBeenCalled()
  })

  it('deletes product and revalidates', async () => {
    requireVendor.mockResolvedValue(VENDOR)
    prisma.store.findUnique.mockResolvedValue(STORE)
    prisma.product.findUnique.mockResolvedValue(PRODUCT)
    await deleteProduct('prod_1')
    expect(prisma.product.delete).toHaveBeenCalledWith({ where: { id: 'prod_1' } })
    expect(revalidatePath).toHaveBeenCalledWith('/store/manage-product')
  })
})

describe('toggleInStock', () => {
  it('returns error when not vendor', async () => {
    requireVendor.mockResolvedValue(null)
    expect(await toggleInStock('prod_1', false)).toEqual({ error: 'Unauthorized' })
  })

  it('returns Forbidden when product belongs to different store', async () => {
    requireVendor.mockResolvedValue(VENDOR)
    prisma.store.findUnique.mockResolvedValue(STORE)
    prisma.product.findUnique.mockResolvedValue({ ...PRODUCT, storeId: 'other_store' })
    expect(await toggleInStock('prod_1', false)).toEqual({ error: 'Forbidden' })
    expect(prisma.product.update).not.toHaveBeenCalled()
  })

  it('updates inStock and revalidates', async () => {
    requireVendor.mockResolvedValue(VENDOR)
    prisma.store.findUnique.mockResolvedValue(STORE)
    prisma.product.findUnique.mockResolvedValue(PRODUCT)
    await toggleInStock('prod_1', false)
    expect(prisma.product.update).toHaveBeenCalledWith({ where: { id: 'prod_1' }, data: { inStock: false } })
    expect(revalidatePath).toHaveBeenCalledWith('/store/manage-product')
  })
})

describe('updateOrderStatus', () => {
  it('returns error when not vendor', async () => {
    requireVendor.mockResolvedValue(null)
    expect(await updateOrderStatus('order_1', 'PROCESSING')).toEqual({ error: 'Unauthorized' })
  })

  it('returns error for invalid status', async () => {
    requireVendor.mockResolvedValue(VENDOR)
    prisma.store.findUnique.mockResolvedValue(STORE)
    expect(await updateOrderStatus('order_1', 'INVALID')).toEqual({ error: 'Invalid status' })
    expect(prisma.order.update).not.toHaveBeenCalled()
  })

  it('returns Forbidden when order belongs to different store', async () => {
    requireVendor.mockResolvedValue(VENDOR)
    prisma.store.findUnique.mockResolvedValue(STORE)
    prisma.order.findUnique.mockResolvedValue({ ...ORDER, storeId: 'other_store' })
    expect(await updateOrderStatus('order_1', 'SHIPPED')).toEqual({ error: 'Forbidden' })
    expect(prisma.order.update).not.toHaveBeenCalled()
  })

  it('updates order status and revalidates', async () => {
    requireVendor.mockResolvedValue(VENDOR)
    prisma.store.findUnique.mockResolvedValue(STORE)
    prisma.order.findUnique.mockResolvedValue(ORDER)
    await updateOrderStatus('order_1', 'SHIPPED')
    expect(prisma.order.update).toHaveBeenCalledWith({ where: { id: 'order_1' }, data: { status: 'SHIPPED' } })
    expect(revalidatePath).toHaveBeenCalledWith('/store/orders')
  })
})
```

- [ ] **Step 2: Run tests — expect 14 failures**

```
npx vitest run __tests__/store/actions.test.js
```

Expected: 14 failures (module not found)

- [ ] **Step 3: Create `app/store/actions.js`**

```js
'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { requireVendor } from '@/lib/auth'

const VALID_ORDER_STATUSES = ['ORDER_PLACED', 'PROCESSING', 'SHIPPED', 'DELIVERED']

async function getVendorStore(userId) {
  return prisma.store.findUnique({ where: { userId } })
}

export async function createProduct(productData) {
  const vendor = await requireVendor()
  if (!vendor) return { error: 'Unauthorized' }

  const store = await getVendorStore(vendor.userId)
  if (!store) return { error: 'Store not found' }

  try {
    await prisma.product.create({
      data: {
        name: productData.name,
        description: productData.description,
        mrp: parseFloat(productData.mrp),
        price: parseFloat(productData.price),
        category: productData.category,
        images: productData.images,
        storeId: store.id,
      },
    })
  } catch {
    return { error: 'Failed to create product' }
  }

  revalidatePath('/store/manage-product')
}

export async function updateProduct(productId, data) {
  const vendor = await requireVendor()
  if (!vendor) return { error: 'Unauthorized' }

  const store = await getVendorStore(vendor.userId)
  if (!store) return { error: 'Store not found' }

  const product = await prisma.product.findUnique({ where: { id: productId } })
  if (!product || product.storeId !== store.id) return { error: 'Forbidden' }

  try {
    await prisma.product.update({
      where: { id: productId },
      data: {
        name: data.name,
        description: data.description,
        mrp: parseFloat(data.mrp),
        price: parseFloat(data.price),
        category: data.category,
        images: data.images,
      },
    })
  } catch {
    return { error: 'Failed to update product' }
  }

  revalidatePath('/store/manage-product')
}

export async function deleteProduct(productId) {
  const vendor = await requireVendor()
  if (!vendor) return { error: 'Unauthorized' }

  const store = await getVendorStore(vendor.userId)
  if (!store) return { error: 'Store not found' }

  const product = await prisma.product.findUnique({ where: { id: productId } })
  if (!product || product.storeId !== store.id) return { error: 'Forbidden' }

  try {
    await prisma.product.delete({ where: { id: productId } })
  } catch {
    return { error: 'Failed to delete product' }
  }

  revalidatePath('/store/manage-product')
}

export async function toggleInStock(productId, inStock) {
  const vendor = await requireVendor()
  if (!vendor) return { error: 'Unauthorized' }

  const store = await getVendorStore(vendor.userId)
  if (!store) return { error: 'Store not found' }

  const product = await prisma.product.findUnique({ where: { id: productId } })
  if (!product || product.storeId !== store.id) return { error: 'Forbidden' }

  try {
    await prisma.product.update({ where: { id: productId }, data: { inStock } })
  } catch {
    return { error: 'Failed to update product' }
  }

  revalidatePath('/store/manage-product')
}

export async function updateOrderStatus(orderId, status) {
  const vendor = await requireVendor()
  if (!vendor) return { error: 'Unauthorized' }

  if (!VALID_ORDER_STATUSES.includes(status)) return { error: 'Invalid status' }

  const store = await getVendorStore(vendor.userId)
  if (!store) return { error: 'Store not found' }

  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order || order.storeId !== store.id) return { error: 'Forbidden' }

  try {
    await prisma.order.update({ where: { id: orderId }, data: { status } })
  } catch {
    return { error: 'Failed to update order' }
  }

  revalidatePath('/store/orders')
}
```

- [ ] **Step 4: Run tests — expect 14 passing**

```
npx vitest run __tests__/store/actions.test.js
```

Expected: 14 passed

- [ ] **Step 5: Run full suite — expect all passing**

```
npx vitest run
```

Expected: all existing tests still pass

- [ ] **Step 6: Commit**

```
git add app/store/actions.js __tests__/store/actions.test.js
git commit -m "feat: add vendor server actions with auth + ownership guard"
```

---

## Task 2: Upload API Route (`app/api/upload/route.js`) + Tests

**Files:**
- Create: `app/api/upload/route.js`
- Create: `__tests__/api/upload.test.js`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/api/upload.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  requireVendor: vi.fn(),
  requireAdmin: vi.fn(),
}))

vi.mock('@/lib/cloudinary', () => ({
  default: {
    uploader: { upload: vi.fn() },
  },
}))

import { requireVendor, requireAdmin } from '@/lib/auth'
import cloudinary from '@/lib/cloudinary'
import { POST } from '@/app/api/upload/route'

const mockFile = {
  arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
  type: 'image/jpeg',
}

const makeRequest = (file = null) => ({
  formData: () => Promise.resolve({ get: (key) => (key === 'file' ? file : null) }),
})

beforeEach(() => vi.clearAllMocks())

describe('POST /api/upload', () => {
  it('returns 401 when neither vendor nor admin', async () => {
    requireVendor.mockResolvedValue(null)
    requireAdmin.mockResolvedValue(null)
    const res = await POST(makeRequest(mockFile))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 400 when no file is provided', async () => {
    requireVendor.mockResolvedValue({ userId: 'u1', role: 'vendor' })
    requireAdmin.mockResolvedValue(null)
    const res = await POST(makeRequest(null))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('No file provided')
  })

  it('uploads file to cloudinary and returns url', async () => {
    requireVendor.mockResolvedValue({ userId: 'u1', role: 'vendor' })
    requireAdmin.mockResolvedValue(null)
    cloudinary.uploader.upload.mockResolvedValue({ secure_url: 'https://res.cloudinary.com/test/image.jpg' })
    const res = await POST(makeRequest(mockFile))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.url).toBe('https://res.cloudinary.com/test/image.jpg')
  })
})
```

- [ ] **Step 2: Run tests — expect 3 failures**

```
npx vitest run __tests__/api/upload.test.js
```

Expected: 3 failures (module not found)

- [ ] **Step 3: Create `app/api/upload/route.js`**

```js
import { NextResponse } from 'next/server'
import cloudinary from '@/lib/cloudinary'
import { requireVendor } from '@/lib/auth'
import { requireAdmin } from '@/lib/auth'

export async function POST(request) {
  const vendor = await requireVendor()
  const admin = await requireAdmin()
  if (!vendor && !admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file')
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const dataURI = `data:${file.type};base64,${buffer.toString('base64')}`

  try {
    const result = await cloudinary.uploader.upload(dataURI, { folder: 'gocart' })
    return NextResponse.json({ url: result.secure_url })
  } catch {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run tests — expect 3 passing**

```
npx vitest run __tests__/api/upload.test.js
```

Expected: 3 passed

- [ ] **Step 5: Run full suite — expect all passing**

```
npx vitest run
```

- [ ] **Step 6: Commit**

```
git add app/api/upload/route.js __tests__/api/upload.test.js
git commit -m "feat: add Cloudinary upload API route with auth guard"
```

---

## Task 3: Wire `StoreLayout` to Real Auth

**Files:**
- Modify: `components/store/StoreLayout.jsx`

The current file uses `'use client'`, `useState`, and `useEffect` with dummy data. Replace the entire file with a server component.

- [ ] **Step 1: Replace `components/store/StoreLayout.jsx`**

```jsx
import { getAuthUser } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowRightIcon } from 'lucide-react'
import SellerNavbar from './StoreNavbar'
import SellerSidebar from './StoreSidebar'

const StoreLayout = async ({ children }) => {
  const { userId } = await getAuthUser()
  if (!userId) redirect('/sign-in')

  const store = await prisma.store.findUnique({ where: { userId } })

  if (!store) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
        <h1 className="text-2xl sm:text-4xl font-semibold text-slate-400">
          You are not authorized to access this page
        </h1>
        <Link
          href="/"
          className="bg-slate-700 text-white flex items-center gap-2 mt-8 p-2 px-6 max-sm:text-sm rounded-full"
        >
          Go to home <ArrowRightIcon size={18} />
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen">
      <SellerNavbar />
      <div className="flex flex-1 items-start h-full overflow-y-scroll no-scrollbar">
        <SellerSidebar storeInfo={{ name: store.name, logo: store.logo }} />
        <div className="flex-1 h-full p-5 lg:pl-12 lg:pt-12 overflow-y-scroll">
          {children}
        </div>
      </div>
    </div>
  )
}

export default StoreLayout
```

- [ ] **Step 2: Run full test suite — expect all passing**

```
npx vitest run
```

- [ ] **Step 3: Commit**

```
git add components/store/StoreLayout.jsx
git commit -m "feat: convert StoreLayout to server component with real auth"
```

---

## Task 4: Vendor Dashboard Page (`app/store/page.jsx`)

**Files:**
- Modify: `app/store/page.jsx`

Convert from `'use client'` dummy-data component to async server component. Replace `router.push` with `<Link>`.

- [ ] **Step 1: Replace `app/store/page.jsx`**

```jsx
import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { CircleDollarSignIcon, ShoppingBasketIcon, StarIcon, TagsIcon } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

export default async function Dashboard() {
  const currency = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || '$'
  const { userId } = await getAuthUser()
  const store = await prisma.store.findUnique({ where: { userId } })

  const [productCount, earningsAgg, orderCount, ratingCount, recentRatings] = await Promise.all([
    prisma.product.count({ where: { storeId: store.id } }),
    prisma.order.aggregate({ where: { storeId: store.id }, _sum: { total: true } }),
    prisma.order.count({ where: { storeId: store.id } }),
    prisma.rating.count({ where: { product: { storeId: store.id } } }),
    prisma.rating.findMany({
      where: { product: { storeId: store.id } },
      include: { product: true, user: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ])

  const earnings = earningsAgg._sum.total ?? 0

  const serializedRatings = recentRatings.map(r => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    product: r.product
      ? { ...r.product, createdAt: r.product.createdAt.toISOString(), updatedAt: r.product.updatedAt.toISOString() }
      : null,
    user: r.user
      ? { ...r.user, emailVerified: r.user.emailVerified?.toISOString() ?? null }
      : null,
  }))

  const statCards = [
    { title: 'Total Products', value: productCount, icon: ShoppingBasketIcon },
    { title: 'Total Earnings', value: currency + earnings.toLocaleString(), icon: CircleDollarSignIcon },
    { title: 'Total Orders', value: orderCount, icon: TagsIcon },
    { title: 'Total Ratings', value: ratingCount, icon: StarIcon },
  ]

  return (
    <div className="text-slate-500 mb-28">
      <h1 className="text-2xl">Seller <span className="text-slate-800 font-medium">Dashboard</span></h1>

      <div className="flex flex-wrap gap-5 my-10 mt-4">
        {statCards.map((card, index) => (
          <div key={index} className="flex items-center gap-11 border border-slate-200 p-3 px-6 rounded-lg">
            <div className="flex flex-col gap-3 text-xs">
              <p>{card.title}</p>
              <b className="text-2xl font-medium text-slate-700">{card.value}</b>
            </div>
            <card.icon size={50} className="w-11 h-11 p-2.5 text-slate-400 bg-slate-100 rounded-full" />
          </div>
        ))}
      </div>

      <h2>Total Reviews</h2>

      <div className="mt-5">
        {serializedRatings.map((review, index) => (
          <div
            key={index}
            className="flex max-sm:flex-col gap-5 sm:items-center justify-between py-6 border-b border-slate-200 text-sm text-slate-600 max-w-4xl"
          >
            <div>
              <div className="flex gap-3">
                <Image
                  src={review.user?.image || '/placeholder.png'}
                  alt=""
                  className="w-10 aspect-square rounded-full"
                  width={100}
                  height={100}
                />
                <div>
                  <p className="font-medium">{review.user?.name}</p>
                  <p className="font-light text-slate-500">{new Date(review.createdAt).toDateString()}</p>
                </div>
              </div>
              <p className="mt-3 text-slate-500 max-w-xs leading-6">{review.review}</p>
            </div>
            <div className="flex flex-col justify-between gap-6 sm:items-end">
              <div className="flex flex-col sm:items-end">
                <p className="text-slate-400">{review.product?.category}</p>
                <p className="font-medium">{review.product?.name}</p>
                <div className="flex items-center">
                  {Array(5).fill('').map((_, i) => (
                    <StarIcon
                      key={i}
                      size={17}
                      className="text-transparent mt-0.5"
                      fill={review.rating >= i + 1 ? '#00C950' : '#D1D5DB'}
                    />
                  ))}
                </div>
              </div>
              <Link
                href={`/product/${review.product?.id}`}
                className="bg-slate-100 px-5 py-2 hover:bg-slate-200 rounded transition-all"
              >
                View Product
              </Link>
            </div>
          </div>
        ))}
        {serializedRatings.length === 0 && (
          <p className="text-slate-400 text-sm">No reviews yet.</p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run full test suite — expect all passing**

```
npx vitest run
```

- [ ] **Step 3: Commit**

```
git add app/store/page.jsx
git commit -m "feat: convert vendor dashboard to server component with real Prisma data"
```

---

## Task 5: Add Product Page + `AddProductClient`

**Files:**
- Modify: `app/store/add-product/page.jsx`
- Create: `app/store/add-product/AddProductClient.jsx`

- [ ] **Step 1: Replace `app/store/add-product/page.jsx`**

```jsx
import AddProductClient from './AddProductClient'

export default function StoreAddProduct() {
  return <AddProductClient />
}
```

- [ ] **Step 2: Create `app/store/add-product/AddProductClient.jsx`**

```jsx
'use client'
import { assets } from '@/assets/assets'
import Image from 'next/image'
import { useState, useTransition } from 'react'
import { toast } from 'react-hot-toast'
import { createProduct } from '@/app/store/actions'

const CATEGORIES = [
  'Electronics', 'Clothing', 'Home & Kitchen', 'Beauty & Health',
  'Toys & Games', 'Sports & Outdoors', 'Books & Media', 'Food & Drink',
  'Hobbies & Crafts', 'Others',
]

const DEFAULT_FORM = { name: '', description: '', mrp: '', price: '', category: '' }

export default function AddProductClient() {
  const [images, setImages] = useState({ 1: null, 2: null, 3: null, 4: null })
  const [form, setForm] = useState(DEFAULT_FORM)
  const [isPending, startTransition] = useTransition()

  const onChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async e => {
    e.preventDefault()
    startTransition(async () => {
      const files = Object.values(images).filter(Boolean)
      if (files.length === 0) {
        toast.error('Add at least one image')
        return
      }

      const uploadedUrls = []
      for (const file of files) {
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch('/api/upload', { method: 'POST', body: fd })
        const data = await res.json()
        if (data.error) {
          toast.error('Image upload failed')
          return
        }
        uploadedUrls.push(data.url)
      }

      const result = await createProduct({ ...form, images: uploadedUrls })
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success('Product added!')
      setImages({ 1: null, 2: null, 3: null, 4: null })
      setForm(DEFAULT_FORM)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="text-slate-500 mb-28">
      <h1 className="text-2xl">Add New <span className="text-slate-800 font-medium">Products</span></h1>
      <p className="mt-7">Product Images</p>

      <div className="flex gap-3 mt-4">
        {Object.keys(images).map(key => (
          <label key={key} htmlFor={`images${key}`}>
            <Image
              width={300}
              height={300}
              className="h-15 w-auto border border-slate-200 rounded cursor-pointer"
              src={images[key] ? URL.createObjectURL(images[key]) : assets.upload_area}
              alt=""
            />
            <input
              type="file"
              accept="image/*"
              id={`images${key}`}
              onChange={e => setImages(prev => ({ ...prev, [key]: e.target.files[0] }))}
              hidden
            />
          </label>
        ))}
      </div>

      <label className="flex flex-col gap-2 my-6">
        Name
        <input
          type="text"
          name="name"
          onChange={onChange}
          value={form.name}
          placeholder="Enter product name"
          className="w-full max-w-sm p-2 px-4 outline-none border border-slate-200 rounded"
          required
        />
      </label>

      <label className="flex flex-col gap-2 my-6">
        Description
        <textarea
          name="description"
          onChange={onChange}
          value={form.description}
          placeholder="Enter product description"
          rows={5}
          className="w-full max-w-sm p-2 px-4 outline-none border border-slate-200 rounded resize-none"
          required
        />
      </label>

      <div className="flex gap-5">
        <label className="flex flex-col gap-2">
          Actual Price ($)
          <input
            type="number"
            name="mrp"
            onChange={onChange}
            value={form.mrp}
            placeholder="0"
            className="w-full max-w-45 p-2 px-4 outline-none border border-slate-200 rounded"
            required
          />
        </label>
        <label className="flex flex-col gap-2">
          Offer Price ($)
          <input
            type="number"
            name="price"
            onChange={onChange}
            value={form.price}
            placeholder="0"
            className="w-full max-w-45 p-2 px-4 outline-none border border-slate-200 rounded"
            required
          />
        </label>
      </div>

      <select
        onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
        value={form.category}
        className="w-full max-w-sm p-2 px-4 my-6 outline-none border border-slate-200 rounded"
        required
      >
        <option value="">Select a category</option>
        {CATEGORIES.map(cat => (
          <option key={cat} value={cat}>{cat}</option>
        ))}
      </select>

      <button
        type="submit"
        disabled={isPending}
        className="bg-slate-800 text-white px-6 mt-7 py-2 hover:bg-slate-900 rounded transition disabled:opacity-50"
      >
        {isPending ? 'Adding...' : 'Add Product'}
      </button>
    </form>
  )
}
```

- [ ] **Step 3: Run full test suite — expect all passing**

```
npx vitest run
```

- [ ] **Step 4: Commit**

```
git add app/store/add-product/page.jsx app/store/add-product/AddProductClient.jsx
git commit -m "feat: convert add-product page to server wrapper + AddProductClient with Cloudinary upload"
```

---

## Task 6: Manage Products Page + `ManageProductClient`

**Files:**
- Modify: `app/store/manage-product/page.jsx`
- Create: `app/store/manage-product/ManageProductClient.jsx`

- [ ] **Step 1: Replace `app/store/manage-product/page.jsx`**

```jsx
import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import ManageProductClient from './ManageProductClient'

export default async function StoreManageProducts() {
  const { userId } = await getAuthUser()
  const store = await prisma.store.findUnique({ where: { userId } })

  const products = await prisma.product.findMany({
    where: { storeId: store.id },
    orderBy: { createdAt: 'desc' },
  })

  const serialized = products.map(p => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }))

  return <ManageProductClient products={serialized} />
}
```

- [ ] **Step 2: Create `app/store/manage-product/ManageProductClient.jsx`**

```jsx
'use client'
import Image from 'next/image'
import Link from 'next/link'
import { useTransition } from 'react'
import { toast } from 'react-hot-toast'
import { toggleInStock, deleteProduct } from '@/app/store/actions'

export default function ManageProductClient({ products }) {
  const currency = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || '$'
  const [isPending, startTransition] = useTransition()

  const handleToggle = (productId, currentInStock) => {
    startTransition(async () => {
      const result = await toggleInStock(productId, !currentInStock)
      if (result?.error) toast.error(result.error)
    })
  }

  const handleDelete = (productId) => {
    if (!window.confirm('Delete this product? This cannot be undone.')) return
    startTransition(async () => {
      const result = await deleteProduct(productId)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success('Product deleted')
      }
    })
  }

  return (
    <>
      <h1 className="text-2xl text-slate-500 mb-5">
        Manage <span className="text-slate-800 font-medium">Products</span>
      </h1>
      {products.length === 0 ? (
        <p className="text-slate-400 text-sm">No products yet. <Link href="/store/add-product" className="text-green-600 underline">Add one.</Link></p>
      ) : (
        <table className="w-full max-w-4xl text-left ring ring-slate-200 rounded overflow-hidden text-sm">
          <thead className="bg-slate-50 text-gray-700 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3 hidden md:table-cell">Description</th>
              <th className="px-4 py-3 hidden md:table-cell">MRP</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">In Stock</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="text-slate-700">
            {products.map(product => (
              <tr key={product.id} className="border-t border-gray-200 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex gap-2 items-center">
                    <Image
                      width={40}
                      height={40}
                      className="p-1 shadow rounded"
                      src={product.images[0] || '/placeholder.png'}
                      alt=""
                    />
                    {product.name}
                  </div>
                </td>
                <td className="px-4 py-3 max-w-md text-slate-600 hidden md:table-cell truncate">
                  {product.description}
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  {currency} {product.mrp.toLocaleString()}
                </td>
                <td className="px-4 py-3">{currency} {product.price.toLocaleString()}</td>
                <td className="px-4 py-3">
                  <label className="relative inline-flex items-center cursor-pointer text-gray-900 gap-3">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={product.inStock}
                      disabled={isPending}
                      onChange={() => handleToggle(product.id, product.inStock)}
                    />
                    <div className="w-9 h-5 bg-slate-300 rounded-full peer peer-checked:bg-green-600 transition-colors duration-200"></div>
                    <span className="dot absolute left-1 top-1 w-3 h-3 bg-white rounded-full transition-transform duration-200 ease-in-out peer-checked:translate-x-4"></span>
                  </label>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/store/edit-product/${product.id}`}
                      className="text-xs bg-slate-100 hover:bg-slate-200 px-3 py-1 rounded transition"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDelete(product.id)}
                      disabled={isPending}
                      className="text-xs bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1 rounded transition disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
```

- [ ] **Step 3: Run full test suite — expect all passing**

```
npx vitest run
```

- [ ] **Step 4: Commit**

```
git add app/store/manage-product/page.jsx app/store/manage-product/ManageProductClient.jsx
git commit -m "feat: convert manage-product page to server component + ManageProductClient with toggle/delete/edit"
```

---

## Task 7: Edit Product Page + `EditProductClient`

**Files:**
- Create: `app/store/edit-product/[id]/page.jsx`
- Create: `app/store/edit-product/[id]/EditProductClient.jsx`

- [ ] **Step 1: Create `app/store/edit-product/[id]/page.jsx`**

```jsx
import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { notFound } from 'next/navigation'
import EditProductClient from './EditProductClient'

export default async function EditProductPage({ params }) {
  const { id } = await params
  const { userId } = await getAuthUser()
  const store = await prisma.store.findUnique({ where: { userId } })

  const product = await prisma.product.findUnique({ where: { id } })
  if (!product || product.storeId !== store.id) notFound()

  const serialized = {
    ...product,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  }

  return <EditProductClient product={serialized} />
}
```

- [ ] **Step 2: Create `app/store/edit-product/[id]/EditProductClient.jsx`**

```jsx
'use client'
import { assets } from '@/assets/assets'
import Image from 'next/image'
import { useState, useTransition } from 'react'
import { toast } from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { updateProduct } from '@/app/store/actions'

const CATEGORIES = [
  'Electronics', 'Clothing', 'Home & Kitchen', 'Beauty & Health',
  'Toys & Games', 'Sports & Outdoors', 'Books & Media', 'Food & Drink',
  'Hobbies & Crafts', 'Others',
]

export default function EditProductClient({ product }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [form, setForm] = useState({
    name: product.name,
    description: product.description,
    mrp: String(product.mrp),
    price: String(product.price),
    category: product.category,
  })

  // slots: each slot has an existing URL (from DB) and optionally a new File to replace it
  const [slots, setSlots] = useState(
    [0, 1, 2, 3].map(i => ({ existingUrl: product.images[i] || null, file: null }))
  )

  const onChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleFileChange = (index, file) => {
    setSlots(prev => prev.map((s, i) => i === index ? { ...s, file } : s))
  }

  const getPreview = slot => {
    if (slot.file) return URL.createObjectURL(slot.file)
    if (slot.existingUrl) return slot.existingUrl
    return assets.upload_area
  }

  const handleSubmit = async e => {
    e.preventDefault()
    startTransition(async () => {
      const imageUrls = []
      for (const slot of slots) {
        if (slot.file) {
          const fd = new FormData()
          fd.append('file', slot.file)
          const res = await fetch('/api/upload', { method: 'POST', body: fd })
          const data = await res.json()
          if (data.error) {
            toast.error('Image upload failed')
            return
          }
          imageUrls.push(data.url)
        } else if (slot.existingUrl) {
          imageUrls.push(slot.existingUrl)
        }
      }

      if (imageUrls.length === 0) {
        toast.error('Product must have at least one image')
        return
      }

      const result = await updateProduct(product.id, { ...form, images: imageUrls })
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success('Product updated!')
      router.push('/store/manage-product')
    })
  }

  return (
    <form onSubmit={handleSubmit} className="text-slate-500 mb-28">
      <h1 className="text-2xl">Edit <span className="text-slate-800 font-medium">Product</span></h1>
      <p className="mt-7">Product Images</p>

      <div className="flex gap-3 mt-4">
        {slots.map((slot, index) => (
          <label key={index} htmlFor={`edit-image-${index}`}>
            <Image
              width={300}
              height={300}
              className="h-15 w-auto border border-slate-200 rounded cursor-pointer"
              src={getPreview(slot)}
              alt=""
            />
            <input
              type="file"
              accept="image/*"
              id={`edit-image-${index}`}
              onChange={e => handleFileChange(index, e.target.files[0])}
              hidden
            />
          </label>
        ))}
      </div>

      <label className="flex flex-col gap-2 my-6">
        Name
        <input
          type="text"
          name="name"
          onChange={onChange}
          value={form.name}
          placeholder="Enter product name"
          className="w-full max-w-sm p-2 px-4 outline-none border border-slate-200 rounded"
          required
        />
      </label>

      <label className="flex flex-col gap-2 my-6">
        Description
        <textarea
          name="description"
          onChange={onChange}
          value={form.description}
          placeholder="Enter product description"
          rows={5}
          className="w-full max-w-sm p-2 px-4 outline-none border border-slate-200 rounded resize-none"
          required
        />
      </label>

      <div className="flex gap-5">
        <label className="flex flex-col gap-2">
          Actual Price ($)
          <input
            type="number"
            name="mrp"
            onChange={onChange}
            value={form.mrp}
            placeholder="0"
            className="w-full max-w-45 p-2 px-4 outline-none border border-slate-200 rounded"
            required
          />
        </label>
        <label className="flex flex-col gap-2">
          Offer Price ($)
          <input
            type="number"
            name="price"
            onChange={onChange}
            value={form.price}
            placeholder="0"
            className="w-full max-w-45 p-2 px-4 outline-none border border-slate-200 rounded"
            required
          />
        </label>
      </div>

      <select
        onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
        value={form.category}
        className="w-full max-w-sm p-2 px-4 my-6 outline-none border border-slate-200 rounded"
        required
      >
        <option value="">Select a category</option>
        {CATEGORIES.map(cat => (
          <option key={cat} value={cat}>{cat}</option>
        ))}
      </select>

      <div className="flex gap-3 mt-7">
        <button
          type="submit"
          disabled={isPending}
          className="bg-slate-800 text-white px-6 py-2 hover:bg-slate-900 rounded transition disabled:opacity-50"
        >
          {isPending ? 'Saving...' : 'Save Changes'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/store/manage-product')}
          className="bg-slate-100 px-6 py-2 hover:bg-slate-200 rounded transition"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 3: Run full test suite — expect all passing**

```
npx vitest run
```

- [ ] **Step 4: Commit**

```
git add app/store/edit-product/
git commit -m "feat: add edit-product page with pre-populated form and Cloudinary image management"
```

---

## Task 8: Orders Page + `OrdersClient`

**Files:**
- Modify: `app/store/orders/page.jsx`
- Create: `app/store/orders/OrdersClient.jsx`

- [ ] **Step 1: Replace `app/store/orders/page.jsx`**

```jsx
import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import OrdersClient from './OrdersClient'

export default async function StoreOrders() {
  const { userId } = await getAuthUser()
  const store = await prisma.store.findUnique({ where: { userId } })

  const orders = await prisma.order.findMany({
    where: { storeId: store.id },
    include: {
      user: true,
      orderItems: { include: { product: true } },
      address: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  const serialized = orders.map(o => ({
    ...o,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    user: o.user
      ? { ...o.user, emailVerified: o.user.emailVerified?.toISOString() ?? null }
      : null,
    address: o.address
      ? { ...o.address, createdAt: o.address.createdAt.toISOString() }
      : null,
    orderItems: o.orderItems.map(item => ({
      ...item,
      product: item.product
        ? { ...item.product, createdAt: item.product.createdAt.toISOString(), updatedAt: item.product.updatedAt.toISOString() }
        : null,
    })),
  }))

  return <OrdersClient orders={serialized} />
}
```

- [ ] **Step 2: Create `app/store/orders/OrdersClient.jsx`**

```jsx
'use client'
import { useState, useTransition } from 'react'
import { toast } from 'react-hot-toast'
import { updateOrderStatus } from '@/app/store/actions'

const ORDER_STATUSES = ['ORDER_PLACED', 'PROCESSING', 'SHIPPED', 'DELIVERED']

export default function OrdersClient({ orders }) {
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [isPending, startTransition] = useTransition()

  const handleStatusChange = (orderId, status) => {
    startTransition(async () => {
      const result = await updateOrderStatus(orderId, status)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success('Status updated')
      }
    })
  }

  return (
    <>
      <h1 className="text-2xl text-slate-500 mb-5">
        Store <span className="text-slate-800 font-medium">Orders</span>
      </h1>

      {orders.length === 0 ? (
        <p className="text-slate-400 text-sm">No orders yet.</p>
      ) : (
        <div className="overflow-x-auto max-w-4xl rounded-md shadow border border-gray-200">
          <table className="w-full text-sm text-left text-gray-600">
            <thead className="bg-gray-50 text-gray-700 text-xs uppercase tracking-wider">
              <tr>
                {['Sr. No.', 'Customer', 'Total', 'Payment', 'Coupon', 'Status', 'Date'].map((h, i) => (
                  <th key={i} className="px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((order, index) => (
                <tr
                  key={order.id}
                  className="hover:bg-gray-50 transition-colors duration-150 cursor-pointer"
                  onClick={() => setSelectedOrder(order)}
                >
                  <td className="pl-6 text-green-600">{index + 1}</td>
                  <td className="px-4 py-3">{order.user?.name}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">${order.total}</td>
                  <td className="px-4 py-3">{order.paymentMethod}</td>
                  <td className="px-4 py-3">
                    {order.isCouponUsed ? (
                      <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full">
                        {order.coupon?.code}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <select
                      value={order.status}
                      onChange={e => handleStatusChange(order.id, e.target.value)}
                      disabled={isPending}
                      className="border-gray-300 rounded-md text-sm focus:ring focus:ring-blue-200 disabled:opacity-50"
                    >
                      {ORDER_STATUSES.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(order.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedOrder && (
        <div
          onClick={() => setSelectedOrder(null)}
          className="fixed inset-0 flex items-center justify-center bg-black/50 text-slate-700 text-sm backdrop-blur-xs z-50"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white rounded-lg shadow-lg max-w-2xl w-full p-6 relative"
          >
            <h2 className="text-xl font-semibold text-slate-900 mb-4 text-center">Order Details</h2>

            <div className="mb-4">
              <h3 className="font-semibold mb-2">Customer Details</h3>
              <p><span className="text-green-700">Name:</span> {selectedOrder.user?.name}</p>
              <p><span className="text-green-700">Email:</span> {selectedOrder.user?.email}</p>
              <p><span className="text-green-700">Phone:</span> {selectedOrder.address?.phone}</p>
              <p>
                <span className="text-green-700">Address:</span>{' '}
                {[
                  selectedOrder.address?.street,
                  selectedOrder.address?.city,
                  selectedOrder.address?.state,
                  selectedOrder.address?.zip,
                  selectedOrder.address?.country,
                ].filter(Boolean).join(', ')}
              </p>
            </div>

            <div className="mb-4">
              <h3 className="font-semibold mb-2">Products</h3>
              <div className="space-y-2">
                {selectedOrder.orderItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-4 border border-slate-100 shadow rounded p-2">
                    <img
                      src={item.product?.images?.[0] || '/placeholder.png'}
                      alt={item.product?.name}
                      className="w-16 h-16 object-cover rounded"
                    />
                    <div className="flex-1">
                      <p className="text-slate-800">{item.product?.name}</p>
                      <p>Qty: {item.quantity}</p>
                      <p>Price: ${item.price}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <p><span className="text-green-700">Payment Method:</span> {selectedOrder.paymentMethod}</p>
              <p><span className="text-green-700">Paid:</span> {selectedOrder.isPaid ? 'Yes' : 'No'}</p>
              {selectedOrder.isCouponUsed && (
                <p>
                  <span className="text-green-700">Coupon:</span>{' '}
                  {selectedOrder.coupon?.code} ({selectedOrder.coupon?.discount}% off)
                </p>
              )}
              <p><span className="text-green-700">Status:</span> {selectedOrder.status}</p>
              <p><span className="text-green-700">Order Date:</span> {new Date(selectedOrder.createdAt).toLocaleString()}</p>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-2 bg-slate-200 rounded hover:bg-slate-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 3: Run full test suite — expect all passing**

```
npx vitest run
```

Expected output:
```
Test Files  8 passed (8)
     Tests  44 passed (44)
```

- [ ] **Step 4: Commit**

```
git add app/store/orders/page.jsx app/store/orders/OrdersClient.jsx
git commit -m "feat: convert orders page to server component + OrdersClient with status updates and modal"
```

---

## Final Checklist

After all 8 tasks are committed:

- [ ] Run `npx vitest run` — all tests pass (27 existing + 18 new = 45 total)
- [ ] Run `npm run dev` and sign in as a vendor
- [ ] Verify `/store` dashboard shows real stat cards (zeros if no data)
- [ ] Verify `/store/add-product` — add a product with an image, confirm it appears in manage-product
- [ ] Verify `/store/manage-product` — toggle in-stock, delete a product, click Edit
- [ ] Verify `/store/edit-product/[id]` — pre-populated form, save changes, redirect back
- [ ] Verify `/store/orders` — orders table loads, status dropdown works, modal opens
- [ ] Update `CONTEXT.md`: mark Phase 3 ✅ complete, update codebase state, set Phase 4 as current
