# Phase 4 — Public Storefront Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire all public storefront pages to real PostgreSQL data via REST API routes, with DB-persisted cart, infinite scroll, and full COD checkout.

**Architecture:** API Routes + Client Components. All data flows through `GET /api/public/*` (unauthenticated) and `GET|POST|PUT|DELETE /api/customer/*` (auth-required). Pages are client components that call these APIs. Every endpoint is mobile-app-ready.

**Tech Stack:** Next.js 16, Prisma 7 (`@prisma/adapter-pg`), Auth.js v5, Redux Toolkit, Vitest, react-hot-toast, next-auth/react

---

## File Map

### New API routes
| File | Route |
|------|-------|
| `app/api/public/products/route.js` | `GET /api/public/products` |
| `app/api/public/products/[id]/route.js` | `GET /api/public/products/[id]` |
| `app/api/public/categories/route.js` | `GET /api/public/categories` |
| `app/api/public/stores/[username]/route.js` | `GET /api/public/stores/[username]` |
| `app/api/public/coupons/validate/route.js` | `POST /api/public/coupons/validate` |
| `app/api/customer/cart/route.js` | `GET|PUT /api/customer/cart` |
| `app/api/customer/addresses/route.js` | `GET|POST /api/customer/addresses` |
| `app/api/customer/addresses/[id]/route.js` | `DELETE /api/customer/addresses/[id]` |
| `app/api/customer/orders/route.js` | `GET|POST /api/customer/orders` |
| `app/api/customer/ratings/route.js` | `POST /api/customer/ratings` |

### New test files
| File | Covers |
|------|--------|
| `__tests__/api/public/products.test.js` | Products list + detail + categories |
| `__tests__/api/public/stores.test.js` | Store lookup |
| `__tests__/api/public/coupons.test.js` | Coupon validation |
| `__tests__/api/customer/cart.test.js` | Cart GET/PUT |
| `__tests__/api/customer/addresses.test.js` | Addresses CRUD |
| `__tests__/api/customer/orders.test.js` | Place + list orders |
| `__tests__/api/customer/ratings.test.js` | Submit rating |

### New components / helpers
| File | Purpose |
|------|---------|
| `lib/syncCart.js` | Fire-and-forget cart sync helper |
| `components/CartSync.jsx` | Hydrates Redux cart from DB on login |

### Modified files
| File | Change |
|------|--------|
| `lib/features/cart/cartSlice.js` | Add `setCart` action |
| `lib/features/product/productSlice.js` | Remove mock data from initial state |
| `app/layout.jsx` | Add `<CartSync />` |
| `components/LatestProducts.jsx` | Fetch from API |
| `components/BestSelling.jsx` | Fetch from API |
| `components/CategoriesMarquee.jsx` | Fetch from API |
| `app/(public)/shop/page.jsx` | Infinite scroll + API |
| `app/(public)/shop/[username]/page.jsx` | Fetch from stores API + infinite scroll |
| `app/(public)/product/[productId]/page.jsx` | Fetch from API |
| `components/ProductDetails.jsx` | Add to cart syncs to DB |
| `components/Counter.jsx` | Add/remove syncs to DB |
| `app/(public)/cart/page.jsx` | Fetch product details from API; delete syncs |
| `components/OrderSummary.jsx` | Addresses dropdown, coupon validate, place order |
| `components/AddressModal.jsx` | POST to API |
| `app/(public)/orders/page.jsx` | Fetch from API |
| `components/OrderItem.jsx` | Ratings from API data (not Redux) |
| `components/RatingModal.jsx` | POST to API |
| `app/(public)/create-store/page.jsx` | Wire form to API |

---

## Task 1: Products List API

**Files:**
- Create: `app/api/public/products/route.js`
- Create: `__tests__/api/public/products.test.js`

- [ ] **Step 1: Write the failing test**

```js
// __tests__/api/public/products.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  default: {
    product: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}))

import { GET } from '@/app/api/public/products/route'
import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'

const PRODUCT = {
  id: 'prod_1',
  name: 'Headphones',
  description: 'Good sound',
  mrp: 100,
  price: 80,
  images: ['https://res.cloudinary.com/demo/image/upload/sample.jpg'],
  category: 'Headphones',
  inStock: true,
  storeId: 'store_1',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  store: { id: 'store_1', name: 'Test Store', username: 'teststore', logo: 'https://logo.url' },
  rating: [{ rating: 5 }, { rating: 4 }],
}

beforeEach(() => vi.clearAllMocks())

describe('GET /api/public/products', () => {
  it('returns paginated products with defaults', async () => {
    prisma.product.findMany.mockResolvedValue([PRODUCT])
    prisma.product.count.mockResolvedValue(1)
    const req = new NextRequest('http://localhost/api/public/products')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.products).toHaveLength(1)
    expect(body.total).toBe(1)
    expect(body.page).toBe(1)
    expect(body.totalPages).toBe(1)
  })

  it('applies search filter', async () => {
    prisma.product.findMany.mockResolvedValue([])
    prisma.product.count.mockResolvedValue(0)
    const req = new NextRequest('http://localhost/api/public/products?search=headphones')
    await GET(req)
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          name: { contains: 'headphones', mode: 'insensitive' },
        }),
      })
    )
  })

  it('applies category filter', async () => {
    prisma.product.findMany.mockResolvedValue([])
    prisma.product.count.mockResolvedValue(0)
    const req = new NextRequest('http://localhost/api/public/products?category=Watch')
    await GET(req)
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { category: 'Watch' } })
    )
  })

  it('sorts by ratingCount when sort=ratingCount', async () => {
    prisma.product.findMany.mockResolvedValue([])
    prisma.product.count.mockResolvedValue(0)
    const req = new NextRequest('http://localhost/api/public/products?sort=ratingCount')
    await GET(req)
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { rating: { _count: 'desc' } } })
    )
  })

  it('respects page and limit params', async () => {
    prisma.product.findMany.mockResolvedValue([])
    prisma.product.count.mockResolvedValue(30)
    const req = new NextRequest('http://localhost/api/public/products?page=3&limit=5')
    const res = await GET(req)
    const body = await res.json()
    expect(body.page).toBe(3)
    expect(body.totalPages).toBe(6)
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 5 })
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
npx vitest run __tests__/api/public/products.test.js
```

Expected: FAIL — `Cannot find module '@/app/api/public/products/route'`

- [ ] **Step 3: Create the route**

```js
// app/api/public/products/route.js
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '12')))
  const search = searchParams.get('search') || ''
  const category = searchParams.get('category') || ''
  const storeId = searchParams.get('storeId') || ''
  const sort = searchParams.get('sort') || 'createdAt'

  const where = {}
  if (search) where.name = { contains: search, mode: 'insensitive' }
  if (category) where.category = category
  if (storeId) where.storeId = storeId

  const orderBy = sort === 'ratingCount'
    ? { rating: { _count: 'desc' } }
    : { createdAt: 'desc' }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        store: { select: { id: true, name: true, username: true, logo: true } },
        rating: { select: { rating: true } },
      },
    }),
    prisma.product.count({ where }),
  ])

  return NextResponse.json({
    products,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

```
npx vitest run __tests__/api/public/products.test.js
```

Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```
git add app/api/public/products/route.js __tests__/api/public/products.test.js
git commit -m "feat: add GET /api/public/products with pagination, search, category, sort"
```

---

## Task 2: Product Detail API + Categories API

**Files:**
- Create: `app/api/public/products/[id]/route.js`
- Create: `app/api/public/categories/route.js`
- Modify: `__tests__/api/public/products.test.js` (append tests)

- [ ] **Step 1: Append product detail + categories tests to `__tests__/api/public/products.test.js`**

Add these imports at the top of the existing test file (after the existing imports):

```js
import { GET as getById } from '@/app/api/public/products/[id]/route'
import { GET as getCategories } from '@/app/api/public/categories/route'
```

Then append these describe blocks at the bottom of the file:

```js
describe('GET /api/public/products/[id]', () => {
  it('returns product with ratings and store', async () => {
    prisma.product.findUnique.mockResolvedValue(PRODUCT)
    const req = new NextRequest('http://localhost/api/public/products/prod_1')
    const res = await getById(req, { params: Promise.resolve({ id: 'prod_1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.product.id).toBe('prod_1')
    expect(body.product.rating).toHaveLength(2)
  })

  it('returns 404 when product not found', async () => {
    prisma.product.findUnique.mockResolvedValue(null)
    const req = new NextRequest('http://localhost/api/public/products/bad_id')
    const res = await getById(req, { params: Promise.resolve({ id: 'bad_id' }) })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })
})

describe('GET /api/public/categories', () => {
  it('returns distinct categories', async () => {
    prisma.product.findMany.mockResolvedValue([
      { category: 'Headphones' },
      { category: 'Watch' },
    ])
    const req = new NextRequest('http://localhost/api/public/categories')
    const res = await getCategories(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.categories).toEqual(['Headphones', 'Watch'])
  })
})
```

- [ ] **Step 2: Run tests to verify new ones fail**

```
npx vitest run __tests__/api/public/products.test.js
```

Expected: 5 pass, 3 fail — missing modules

- [ ] **Step 3: Create the product detail route**

```js
// app/api/public/products/[id]/route.js
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(req, { params }) {
  const { id } = await params

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      store: {
        select: { id: true, name: true, username: true, logo: true, description: true },
      },
      rating: {
        include: {
          user: { select: { id: true, name: true, image: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  return NextResponse.json({ product })
}
```

- [ ] **Step 4: Create the categories route**

```js
// app/api/public/categories/route.js
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  const rows = await prisma.product.findMany({
    select: { category: true },
    distinct: ['category'],
    orderBy: { category: 'asc' },
  })
  return NextResponse.json({ categories: rows.map(r => r.category) })
}
```

- [ ] **Step 5: Run all tests to verify they pass**

```
npx vitest run __tests__/api/public/products.test.js
```

Expected: 8 tests PASS

- [ ] **Step 6: Commit**

```
git add app/api/public/products/[id]/route.js app/api/public/categories/route.js __tests__/api/public/products.test.js
git commit -m "feat: add GET /api/public/products/[id] and GET /api/public/categories"
```

---

## Task 3: Stores API

**Files:**
- Create: `app/api/public/stores/[username]/route.js`
- Create: `__tests__/api/public/stores.test.js`

- [ ] **Step 1: Write the failing test**

```js
// __tests__/api/public/stores.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  default: {
    store: { findUnique: vi.fn() },
    product: { findMany: vi.fn(), count: vi.fn() },
  },
}))

import { GET } from '@/app/api/public/stores/[username]/route'
import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'

const STORE = {
  id: 'store_1',
  name: 'Test Store',
  username: 'teststore',
  description: 'A great store',
  address: '123 Main St',
  logo: 'https://logo.url',
  email: 'store@test.com',
  contact: '1234567890',
  status: 'approved',
  isActive: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
}

const PRODUCT = {
  id: 'prod_1',
  name: 'Headphones',
  price: 80,
  mrp: 100,
  images: ['https://img.url'],
  category: 'Headphones',
  inStock: true,
  storeId: 'store_1',
  rating: [],
  store: STORE,
  createdAt: new Date(),
  updatedAt: new Date(),
}

beforeEach(() => vi.clearAllMocks())

describe('GET /api/public/stores/[username]', () => {
  it('returns store info and products', async () => {
    prisma.store.findUnique.mockResolvedValue(STORE)
    prisma.product.findMany.mockResolvedValue([PRODUCT])
    prisma.product.count.mockResolvedValue(1)
    const req = new NextRequest('http://localhost/api/public/stores/teststore')
    const res = await GET(req, { params: Promise.resolve({ username: 'teststore' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.store.username).toBe('teststore')
    expect(body.products).toHaveLength(1)
    expect(body.total).toBe(1)
  })

  it('returns 404 when store not found', async () => {
    prisma.store.findUnique.mockResolvedValue(null)
    const req = new NextRequest('http://localhost/api/public/stores/nostore')
    const res = await GET(req, { params: Promise.resolve({ username: 'nostore' }) })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('returns 404 when store is not approved', async () => {
    prisma.store.findUnique.mockResolvedValue({ ...STORE, status: 'pending' })
    const req = new NextRequest('http://localhost/api/public/stores/teststore')
    const res = await GET(req, { params: Promise.resolve({ username: 'teststore' }) })
    expect(res.status).toBe(404)
  })

  it('returns 404 when store is inactive', async () => {
    prisma.store.findUnique.mockResolvedValue({ ...STORE, isActive: false })
    const req = new NextRequest('http://localhost/api/public/stores/teststore')
    const res = await GET(req, { params: Promise.resolve({ username: 'teststore' }) })
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
npx vitest run __tests__/api/public/stores.test.js
```

Expected: FAIL — missing module

- [ ] **Step 3: Create the route**

```js
// app/api/public/stores/[username]/route.js
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(req, { params }) {
  const { username } = await params
  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '12')))

  const store = await prisma.store.findUnique({ where: { username } })

  if (!store || store.status !== 'approved' || !store.isActive) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        store: { select: { id: true, name: true, username: true, logo: true } },
        rating: { select: { rating: true } },
      },
    }),
    prisma.product.count({ where: { storeId: store.id } }),
  ])

  return NextResponse.json({
    store,
    products,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx vitest run __tests__/api/public/stores.test.js
```

Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```
git add app/api/public/stores/[username]/route.js __tests__/api/public/stores.test.js
git commit -m "feat: add GET /api/public/stores/[username]"
```

---

## Task 4: Coupons Validate API

**Files:**
- Create: `app/api/public/coupons/validate/route.js`
- Create: `__tests__/api/public/coupons.test.js`

- [ ] **Step 1: Write the failing test**

```js
// __tests__/api/public/coupons.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  default: {
    coupon: { findUnique: vi.fn() },
  },
}))

import { POST } from '@/app/api/public/coupons/validate/route'
import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'

const VALID_COUPON = {
  code: 'SAVE10',
  description: '10% off your order',
  discount: 10,
  isPublic: true,
  forNewUser: false,
  forMember: false,
  expiresAt: new Date(Date.now() + 86400000), // tomorrow
}

beforeEach(() => vi.clearAllMocks())

const makeReq = (body) =>
  new NextRequest('http://localhost/api/public/coupons/validate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })

describe('POST /api/public/coupons/validate', () => {
  it('returns discount for valid coupon', async () => {
    prisma.coupon.findUnique.mockResolvedValue(VALID_COUPON)
    const res = await POST(makeReq({ code: 'SAVE10' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.discount).toBe(10)
    expect(body.description).toBe('10% off your order')
    expect(body.code).toBe('SAVE10')
  })

  it('is case-insensitive', async () => {
    prisma.coupon.findUnique.mockResolvedValue(VALID_COUPON)
    const res = await POST(makeReq({ code: 'save10' }))
    expect(res.status).toBe(200)
    expect(prisma.coupon.findUnique).toHaveBeenCalledWith({
      where: { code: 'SAVE10' },
    })
  })

  it('returns 404 for non-existent coupon', async () => {
    prisma.coupon.findUnique.mockResolvedValue(null)
    const res = await POST(makeReq({ code: 'BADCODE' }))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('returns 400 for expired coupon', async () => {
    prisma.coupon.findUnique.mockResolvedValue({
      ...VALID_COUPON,
      expiresAt: new Date(Date.now() - 86400000), // yesterday
    })
    const res = await POST(makeReq({ code: 'SAVE10' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/expired/i)
  })

  it('returns 400 when code is missing', async () => {
    const res = await POST(makeReq({}))
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
npx vitest run __tests__/api/public/coupons.test.js
```

Expected: FAIL — missing module

- [ ] **Step 3: Create the route**

```js
// app/api/public/coupons/validate/route.js
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function POST(req) {
  const { code } = await req.json()

  if (!code) {
    return NextResponse.json({ error: 'Coupon code is required' }, { status: 400 })
  }

  const coupon = await prisma.coupon.findUnique({
    where: { code: code.toUpperCase() },
  })

  if (!coupon) {
    return NextResponse.json({ error: 'Coupon not found' }, { status: 404 })
  }

  if (new Date(coupon.expiresAt) < new Date()) {
    return NextResponse.json({ error: 'Coupon has expired' }, { status: 400 })
  }

  return NextResponse.json({
    code: coupon.code,
    discount: coupon.discount,
    description: coupon.description,
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx vitest run __tests__/api/public/coupons.test.js
```

Expected: 5 tests PASS

- [ ] **Step 5: Run full test suite to confirm no regressions**

```
npx vitest run
```

Expected: 45 existing + 18 new = 63 tests PASS

- [ ] **Step 6: Commit**

```
git add app/api/public/coupons/validate/route.js __tests__/api/public/coupons.test.js
git commit -m "feat: add POST /api/public/coupons/validate"
```

---

<!-- PLAN CONTINUES — Tasks 5–18 to be written in subsequent parts -->
