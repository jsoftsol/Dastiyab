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

## Task 5: Cart API

**Files:**
- Create: `app/api/customer/cart/route.js`
- Create: `__tests__/api/customer/cart.test.js`

- [ ] **Step 1: Write the failing test**

```js
// __tests__/api/customer/cart.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  default: {
    user: { findUnique: vi.fn(), update: vi.fn() },
  },
}))

import { GET, PUT } from '@/app/api/customer/cart/route'
import { NextRequest } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import prisma from '@/lib/prisma'

const USER = { userId: 'user_1' }

beforeEach(() => vi.clearAllMocks())

describe('GET /api/customer/cart', () => {
  it('returns empty cart for unauthenticated users', async () => {
    getAuthUser.mockResolvedValue({ userId: null })
    const req = new NextRequest('http://localhost/api/customer/cart')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.cart).toEqual({})
  })

  it('returns DB cart for authenticated user', async () => {
    getAuthUser.mockResolvedValue(USER)
    prisma.user.findUnique.mockResolvedValue({ cart: { prod_1: 2 } })
    const req = new NextRequest('http://localhost/api/customer/cart')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.cart).toEqual({ prod_1: 2 })
  })
})

describe('PUT /api/customer/cart', () => {
  it('returns 401 when not authenticated', async () => {
    getAuthUser.mockResolvedValue({ userId: null })
    const req = new NextRequest('http://localhost/api/customer/cart', {
      method: 'PUT',
      body: JSON.stringify({ cart: { prod_1: 1 } }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PUT(req)
    expect(res.status).toBe(401)
  })

  it('syncs cart to DB for authenticated user', async () => {
    getAuthUser.mockResolvedValue(USER)
    prisma.user.update.mockResolvedValue({})
    const req = new NextRequest('http://localhost/api/customer/cart', {
      method: 'PUT',
      body: JSON.stringify({ cart: { prod_1: 3 } }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PUT(req)
    expect(res.status).toBe(200)
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user_1' },
      data: { cart: { prod_1: 3 } },
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
npx vitest run __tests__/api/customer/cart.test.js
```

Expected: FAIL — missing module

- [ ] **Step 3: Create the route**

```js
// app/api/customer/cart/route.js
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

export async function GET() {
  const { userId } = await getAuthUser()
  if (!userId) return NextResponse.json({ cart: {} })

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { cart: true },
  })

  return NextResponse.json({ cart: user?.cart || {} })
}

export async function PUT(req) {
  const { userId } = await getAuthUser()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { cart } = await req.json()

  await prisma.user.update({
    where: { id: userId },
    data: { cart },
  })

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx vitest run __tests__/api/customer/cart.test.js
```

Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```
git add app/api/customer/cart/route.js __tests__/api/customer/cart.test.js
git commit -m "feat: add GET|PUT /api/customer/cart"
```

---

## Task 6: Addresses API

**Files:**
- Create: `app/api/customer/addresses/route.js`
- Create: `app/api/customer/addresses/[id]/route.js`
- Create: `__tests__/api/customer/addresses.test.js`

- [ ] **Step 1: Write the failing test**

```js
// __tests__/api/customer/addresses.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  default: {
    address: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

import { GET, POST } from '@/app/api/customer/addresses/route'
import { DELETE } from '@/app/api/customer/addresses/[id]/route'
import { NextRequest } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import prisma from '@/lib/prisma'

const USER = { userId: 'user_1' }
const ADDRESS = {
  id: 'addr_1',
  userId: 'user_1',
  name: 'Home',
  email: 'user@test.com',
  street: '123 Main St',
  city: 'Karachi',
  state: 'Sindh',
  zip: '75000',
  country: 'Pakistan',
  phone: '03001234567',
  createdAt: new Date(),
}

beforeEach(() => vi.clearAllMocks())

describe('GET /api/customer/addresses', () => {
  it('returns 401 when not authenticated', async () => {
    getAuthUser.mockResolvedValue({ userId: null })
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns list of addresses', async () => {
    getAuthUser.mockResolvedValue(USER)
    prisma.address.findMany.mockResolvedValue([ADDRESS])
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.addresses).toHaveLength(1)
  })
})

describe('POST /api/customer/addresses', () => {
  it('returns 401 when not authenticated', async () => {
    getAuthUser.mockResolvedValue({ userId: null })
    const req = new NextRequest('http://localhost/api/customer/addresses', {
      method: 'POST',
      body: JSON.stringify(ADDRESS),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 when required fields are missing', async () => {
    getAuthUser.mockResolvedValue(USER)
    const req = new NextRequest('http://localhost/api/customer/addresses', {
      method: 'POST',
      body: JSON.stringify({ name: 'Home' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('creates and returns new address', async () => {
    getAuthUser.mockResolvedValue(USER)
    prisma.address.create.mockResolvedValue(ADDRESS)
    const req = new NextRequest('http://localhost/api/customer/addresses', {
      method: 'POST',
      body: JSON.stringify({ name: 'Home', email: 'user@test.com', street: '123 Main St', city: 'Karachi', state: 'Sindh', zip: '75000', country: 'Pakistan', phone: '03001234567' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.address.id).toBe('addr_1')
    expect(prisma.address.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'user_1', name: 'Home' }),
    })
  })
})

describe('DELETE /api/customer/addresses/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    getAuthUser.mockResolvedValue({ userId: null })
    const req = new NextRequest('http://localhost/api/customer/addresses/addr_1', { method: 'DELETE' })
    const res = await DELETE(req, { params: Promise.resolve({ id: 'addr_1' }) })
    expect(res.status).toBe(401)
  })

  it('returns 404 when address belongs to a different user', async () => {
    getAuthUser.mockResolvedValue(USER)
    prisma.address.findUnique.mockResolvedValue({ ...ADDRESS, userId: 'other_user' })
    const req = new NextRequest('http://localhost/api/customer/addresses/addr_1', { method: 'DELETE' })
    const res = await DELETE(req, { params: Promise.resolve({ id: 'addr_1' }) })
    expect(res.status).toBe(404)
    expect(prisma.address.delete).not.toHaveBeenCalled()
  })

  it('deletes address and returns success', async () => {
    getAuthUser.mockResolvedValue(USER)
    prisma.address.findUnique.mockResolvedValue(ADDRESS)
    prisma.address.delete.mockResolvedValue(ADDRESS)
    const req = new NextRequest('http://localhost/api/customer/addresses/addr_1', { method: 'DELETE' })
    const res = await DELETE(req, { params: Promise.resolve({ id: 'addr_1' }) })
    expect(res.status).toBe(200)
    expect(prisma.address.delete).toHaveBeenCalledWith({ where: { id: 'addr_1' } })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
npx vitest run __tests__/api/customer/addresses.test.js
```

Expected: FAIL — missing modules

- [ ] **Step 3: Create `app/api/customer/addresses/route.js`**

```js
// app/api/customer/addresses/route.js
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

export async function GET() {
  const { userId } = await getAuthUser()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const addresses = await prisma.address.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ addresses })
}

export async function POST(req) {
  const { userId } = await getAuthUser()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, email, street, city, state, zip, country, phone } = await req.json()

  if (!name || !email || !street || !city || !state || !zip || !country || !phone) {
    return NextResponse.json({ error: 'All address fields are required' }, { status: 400 })
  }

  const address = await prisma.address.create({
    data: { userId, name, email, street, city, state, zip, country, phone },
  })

  return NextResponse.json({ address }, { status: 201 })
}
```

- [ ] **Step 4: Create `app/api/customer/addresses/[id]/route.js`**

```js
// app/api/customer/addresses/[id]/route.js
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

export async function DELETE(req, { params }) {
  const { id } = await params
  const { userId } = await getAuthUser()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const address = await prisma.address.findUnique({ where: { id } })
  if (!address || address.userId !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.address.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 5: Run tests to verify they pass**

```
npx vitest run __tests__/api/customer/addresses.test.js
```

Expected: 6 tests PASS

- [ ] **Step 6: Commit**

```
git add app/api/customer/addresses/route.js app/api/customer/addresses/[id]/route.js __tests__/api/customer/addresses.test.js
git commit -m "feat: add GET|POST /api/customer/addresses and DELETE /api/customer/addresses/[id]"
```

---

## Task 7: Orders API

**Files:**
- Create: `app/api/customer/orders/route.js`
- Create: `__tests__/api/customer/orders.test.js`

- [ ] **Step 1: Write the failing test**

```js
// __tests__/api/customer/orders.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  default: {
    order: { findMany: vi.fn(), create: vi.fn() },
    product: { findMany: vi.fn() },
    coupon: { findUnique: vi.fn() },
    user: { update: vi.fn() },
    $transaction: vi.fn(),
  },
}))

import { GET, POST } from '@/app/api/customer/orders/route'
import { NextRequest } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import prisma from '@/lib/prisma'

const USER = { userId: 'user_1' }
const PRODUCT = { id: 'prod_1', name: 'Headphones', price: 80, inStock: true, storeId: 'store_1' }
const ADDRESS = { id: 'addr_1', name: 'Home', street: '123 Main', city: 'Karachi', state: 'Sindh', zip: '75000', country: 'Pakistan', phone: '03001234567' }
const ORDER = {
  id: 'order_1', total: 80, status: 'ORDER_PLACED', userId: 'user_1', storeId: 'store_1',
  addressId: 'addr_1', paymentMethod: 'COD', isCouponUsed: false, coupon: {},
  createdAt: new Date(), updatedAt: new Date(),
  orderItems: [{ orderId: 'order_1', productId: 'prod_1', quantity: 1, price: 80, product: { id: 'prod_1', name: 'Headphones', images: [], category: 'Headphones' } }],
  address: ADDRESS,
}

const makeReq = (body) =>
  new NextRequest('http://localhost/api/customer/orders', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })

beforeEach(() => vi.clearAllMocks())

describe('GET /api/customer/orders', () => {
  it('returns 401 when not authenticated', async () => {
    getAuthUser.mockResolvedValue({ userId: null })
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns orders for authenticated user', async () => {
    getAuthUser.mockResolvedValue(USER)
    prisma.order.findMany.mockResolvedValue([ORDER])
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.orders).toHaveLength(1)
  })
})

describe('POST /api/customer/orders', () => {
  it('returns 401 when not authenticated', async () => {
    getAuthUser.mockResolvedValue({ userId: null })
    const res = await POST(makeReq({ addressId: 'addr_1', items: [{ productId: 'prod_1', quantity: 1 }] }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when addressId is missing', async () => {
    getAuthUser.mockResolvedValue(USER)
    const res = await POST(makeReq({ items: [{ productId: 'prod_1', quantity: 1 }] }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when items is empty', async () => {
    getAuthUser.mockResolvedValue(USER)
    const res = await POST(makeReq({ addressId: 'addr_1', items: [] }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when a product is out of stock', async () => {
    getAuthUser.mockResolvedValue(USER)
    prisma.product.findMany.mockResolvedValue([{ ...PRODUCT, inStock: false }])
    const res = await POST(makeReq({ addressId: 'addr_1', items: [{ productId: 'prod_1', quantity: 1 }] }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/out of stock/i)
  })

  it('creates order grouped by store and clears cart', async () => {
    getAuthUser.mockResolvedValue(USER)
    prisma.product.findMany.mockResolvedValue([PRODUCT])
    prisma.$transaction.mockImplementation(async (fn) => fn(prisma))
    prisma.order.create.mockResolvedValue(ORDER)
    prisma.user.update.mockResolvedValue({})
    const res = await POST(makeReq({ addressId: 'addr_1', items: [{ productId: 'prod_1', quantity: 1 }] }))
    expect(res.status).toBe(201)
    expect(prisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'user_1', storeId: 'store_1', addressId: 'addr_1', paymentMethod: 'COD' }),
      })
    )
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'user_1' }, data: { cart: {} } })
  })

  it('returns 400 when coupon is expired at order time', async () => {
    getAuthUser.mockResolvedValue(USER)
    prisma.product.findMany.mockResolvedValue([PRODUCT])
    prisma.coupon.findUnique.mockResolvedValue({
      code: 'SAVE10', discount: 10, description: '10% off',
      expiresAt: new Date(Date.now() - 86400000),
    })
    const res = await POST(makeReq({ addressId: 'addr_1', couponCode: 'SAVE10', items: [{ productId: 'prod_1', quantity: 1 }] }))
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
npx vitest run __tests__/api/customer/orders.test.js
```

Expected: FAIL — missing module

- [ ] **Step 3: Create the route**

```js
// app/api/customer/orders/route.js
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

export async function GET() {
  const { userId } = await getAuthUser()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orders = await prisma.order.findMany({
    where: { userId },
    include: {
      orderItems: {
        include: {
          product: { select: { id: true, name: true, images: true, category: true } },
        },
      },
      address: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ orders })
}

export async function POST(req) {
  const { userId } = await getAuthUser()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { addressId, couponCode, items } = await req.json()

  if (!addressId) return NextResponse.json({ error: 'Address is required' }, { status: 400 })
  if (!items || items.length === 0) return NextResponse.json({ error: 'Cart is empty' }, { status: 400 })

  const productIds = items.map(i => i.productId)
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, price: true, inStock: true, storeId: true },
  })

  const outOfStock = products.find(p => !p.inStock)
  if (outOfStock) {
    return NextResponse.json({ error: `${outOfStock.name} is out of stock` }, { status: 400 })
  }

  const productMap = Object.fromEntries(products.map(p => [p.id, p]))
  const enrichedItems = items.map(i => ({
    productId: i.productId,
    quantity: i.quantity,
    price: productMap[i.productId].price,
    storeId: productMap[i.productId].storeId,
  }))

  let couponData = {}
  let discountRate = 0
  if (couponCode) {
    const coupon = await prisma.coupon.findUnique({ where: { code: couponCode.toUpperCase() } })
    if (!coupon || new Date(coupon.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'Coupon is invalid or expired' }, { status: 400 })
    }
    discountRate = coupon.discount / 100
    couponData = { code: coupon.code, discount: coupon.discount, description: coupon.description }
  }

  const byStore = {}
  for (const item of enrichedItems) {
    if (!byStore[item.storeId]) byStore[item.storeId] = []
    byStore[item.storeId].push(item)
  }

  const grandTotal = enrichedItems.reduce((sum, i) => sum + i.price * i.quantity, 0)

  const createdOrders = await prisma.$transaction(async (tx) => {
    const results = []
    for (const [storeId, storeItems] of Object.entries(byStore)) {
      const storeSubtotal = storeItems.reduce((sum, i) => sum + i.price * i.quantity, 0)
      const storeDiscount = grandTotal > 0
        ? (storeSubtotal / grandTotal) * discountRate * storeSubtotal
        : 0
      const storeTotal = parseFloat((storeSubtotal - storeDiscount).toFixed(2))

      const order = await tx.order.create({
        data: {
          total: storeTotal,
          userId,
          storeId,
          addressId,
          paymentMethod: 'COD',
          isCouponUsed: !!couponCode,
          coupon: couponData,
          orderItems: {
            create: storeItems.map(i => ({
              productId: i.productId,
              quantity: i.quantity,
              price: i.price,
            })),
          },
        },
        include: {
          orderItems: {
            include: {
              product: { select: { id: true, name: true, images: true, category: true } },
            },
          },
          address: true,
        },
      })
      results.push(order)
    }
    await tx.user.update({ where: { id: userId }, data: { cart: {} } })
    return results
  })

  return NextResponse.json({ orders: createdOrders }, { status: 201 })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx vitest run __tests__/api/customer/orders.test.js
```

Expected: 7 tests PASS

- [ ] **Step 5: Commit**

```
git add app/api/customer/orders/route.js __tests__/api/customer/orders.test.js
git commit -m "feat: add GET|POST /api/customer/orders with multi-store grouping"
```

---

## Task 8: Ratings API

**Files:**
- Create: `app/api/customer/ratings/route.js`
- Create: `__tests__/api/customer/ratings.test.js`

- [ ] **Step 1: Write the failing test**

```js
// __tests__/api/customer/ratings.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  default: {
    order: { findUnique: vi.fn() },
    rating: { findUnique: vi.fn(), create: vi.fn() },
  },
}))

import { POST } from '@/app/api/customer/ratings/route'
import { NextRequest } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import prisma from '@/lib/prisma'

const USER = { userId: 'user_1' }
const ORDER = { id: 'order_1', userId: 'user_1', status: 'DELIVERED' }
const RATING_ROW = {
  id: 'rating_1', orderId: 'order_1', productId: 'prod_1',
  userId: 'user_1', rating: 4, review: 'Great!', createdAt: new Date(),
}

beforeEach(() => vi.clearAllMocks())

const makeReq = (body) =>
  new NextRequest('http://localhost/api/customer/ratings', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })

describe('POST /api/customer/ratings', () => {
  it('returns 401 when not authenticated', async () => {
    getAuthUser.mockResolvedValue({ userId: null })
    const res = await POST(makeReq({ orderId: 'order_1', productId: 'prod_1', rating: 4 }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when required fields are missing', async () => {
    getAuthUser.mockResolvedValue(USER)
    const res = await POST(makeReq({ orderId: 'order_1' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when rating is out of range', async () => {
    getAuthUser.mockResolvedValue(USER)
    const res = await POST(makeReq({ orderId: 'order_1', productId: 'prod_1', rating: 6 }))
    expect(res.status).toBe(400)
  })

  it('returns 404 when order does not belong to user', async () => {
    getAuthUser.mockResolvedValue(USER)
    prisma.order.findUnique.mockResolvedValue({ ...ORDER, userId: 'other_user' })
    const res = await POST(makeReq({ orderId: 'order_1', productId: 'prod_1', rating: 4, review: 'Good' }))
    expect(res.status).toBe(404)
  })

  it('returns 400 when order is not delivered', async () => {
    getAuthUser.mockResolvedValue(USER)
    prisma.order.findUnique.mockResolvedValue({ ...ORDER, status: 'PROCESSING' })
    const res = await POST(makeReq({ orderId: 'order_1', productId: 'prod_1', rating: 4, review: 'Good' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/delivered/i)
  })

  it('returns 400 when already rated', async () => {
    getAuthUser.mockResolvedValue(USER)
    prisma.order.findUnique.mockResolvedValue(ORDER)
    prisma.rating.findUnique.mockResolvedValue(RATING_ROW)
    const res = await POST(makeReq({ orderId: 'order_1', productId: 'prod_1', rating: 4, review: 'Good' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/already rated/i)
  })

  it('creates rating and returns 201', async () => {
    getAuthUser.mockResolvedValue(USER)
    prisma.order.findUnique.mockResolvedValue(ORDER)
    prisma.rating.findUnique.mockResolvedValue(null)
    prisma.rating.create.mockResolvedValue(RATING_ROW)
    const res = await POST(makeReq({ orderId: 'order_1', productId: 'prod_1', rating: 4, review: 'Great product!' }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.rating.id).toBe('rating_1')
    expect(prisma.rating.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'user_1', orderId: 'order_1', productId: 'prod_1', rating: 4 }),
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
npx vitest run __tests__/api/customer/ratings.test.js
```

Expected: FAIL — missing module

- [ ] **Step 3: Create the route**

```js
// app/api/customer/ratings/route.js
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

export async function POST(req) {
  const { userId } = await getAuthUser()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { orderId, productId, rating, review } = await req.json()

  if (!orderId || !productId || !rating) {
    return NextResponse.json({ error: 'orderId, productId, and rating are required' }, { status: 400 })
  }

  if (rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 })
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order || order.userId !== userId) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  if (order.status !== 'DELIVERED') {
    return NextResponse.json({ error: 'Can only rate delivered orders' }, { status: 400 })
  }

  const existing = await prisma.rating.findUnique({
    where: { userId_productId_orderId: { userId, productId, orderId } },
  })
  if (existing) {
    return NextResponse.json({ error: 'Already rated this product for this order' }, { status: 400 })
  }

  const newRating = await prisma.rating.create({
    data: { userId, productId, orderId, rating, review: review || '' },
  })

  return NextResponse.json({ rating: newRating }, { status: 201 })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx vitest run __tests__/api/customer/ratings.test.js
```

Expected: 7 tests PASS

- [ ] **Step 5: Run full test suite to confirm no regressions**

```
npx vitest run
```

Expected: 45 existing + ~33 new = ~78 tests PASS

- [ ] **Step 6: Commit**

```
git add app/api/customer/ratings/route.js __tests__/api/customer/ratings.test.js
git commit -m "feat: add POST /api/customer/ratings with delivered-order and duplicate guards"
```

---

<!-- PLAN CONTINUES — Tasks 9–18 to be written in subsequent parts -->
