# Phase 5 — Platform Services Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce coupon flags (`isPublic`, `forMember`, `forNewUser`) in the validate and orders routes, and add computed `averageRating`/`ratingCount` fields to product API responses.

**Architecture:** Approach A — the existing validate endpoint becomes auth-aware via an optional `getAuthUser()` call (returns null when unauthenticated, never throws). The orders route re-checks the same flags as a server-side backstop. Both product routes compute aggregates from the already-fetched `rating` array — no schema changes.

**Tech Stack:** Next.js 16 route handlers, Prisma 7, Vitest, `@/lib/auth` (`getAuthUser`), `@/lib/prisma`

---

## Files Modified

| File | Change |
|------|--------|
| `app/api/public/coupons/validate/route.js` | Add auth-aware flag checks |
| `app/api/customer/orders/route.js` | Add coupon flag re-check before `$transaction` |
| `app/api/public/products/route.js` | Compute `averageRating`/`ratingCount`, strip raw `rating` array |
| `app/api/public/products/[id]/route.js` | Compute `averageRating`/`ratingCount`, keep full `rating` array |
| `__tests__/api/public/coupons.test.js` | Add auth mock + 6 new flag test cases |
| `__tests__/api/customer/orders.test.js` | Add `order.count` to mock + 3 new flag test cases |
| `__tests__/api/public/products.test.js` | Add 5 new aggregation test cases |

---

## Task 1: Coupon validate — flag enforcement

**Files:**
- Modify: `app/api/public/coupons/validate/route.js`
- Modify: `__tests__/api/public/coupons.test.js`

- [ ] **Step 1: Write the failing tests**

Replace the entire contents of `__tests__/api/public/coupons.test.js` with:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  default: {
    coupon: { findUnique: vi.fn() },
    order: { count: vi.fn() },
  },
}))

import { POST } from '@/app/api/public/coupons/validate/route'
import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

const VALID_COUPON = {
  code: 'SAVE10',
  description: '10% off your order',
  discount: 10,
  isPublic: true,
  forNewUser: false,
  forMember: false,
  expiresAt: new Date(Date.now() + 86400000),
}

beforeEach(() => {
  vi.clearAllMocks()
  getAuthUser.mockResolvedValue({ userId: null })
})

const makeReq = (body) =>
  new NextRequest('http://localhost/api/public/coupons/validate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })

describe('POST /api/public/coupons/validate', () => {
  it('returns discount for valid public coupon', async () => {
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
      expiresAt: new Date(Date.now() - 86400000),
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

  it('returns 500 when Prisma throws', async () => {
    prisma.coupon.findUnique.mockRejectedValue(new Error('DB error'))
    const res = await POST(makeReq({ code: 'SAVE10' }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('returns 400 for non-public coupon', async () => {
    prisma.coupon.findUnique.mockResolvedValue({ ...VALID_COUPON, isPublic: false })
    const res = await POST(makeReq({ code: 'SAVE10' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/not available/i)
  })

  it('returns 400 for forMember coupon when not authenticated', async () => {
    prisma.coupon.findUnique.mockResolvedValue({ ...VALID_COUPON, forMember: true })
    const res = await POST(makeReq({ code: 'SAVE10' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/sign in/i)
  })

  it('accepts forMember coupon when authenticated', async () => {
    getAuthUser.mockResolvedValue({ userId: 'user_1' })
    prisma.coupon.findUnique.mockResolvedValue({ ...VALID_COUPON, forMember: true })
    const res = await POST(makeReq({ code: 'SAVE10' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.discount).toBe(10)
  })

  it('returns 400 for forNewUser coupon when not authenticated', async () => {
    prisma.coupon.findUnique.mockResolvedValue({ ...VALID_COUPON, forNewUser: true })
    const res = await POST(makeReq({ code: 'SAVE10' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/sign in/i)
  })

  it('returns 400 for forNewUser coupon when user has prior orders', async () => {
    getAuthUser.mockResolvedValue({ userId: 'user_1' })
    prisma.coupon.findUnique.mockResolvedValue({ ...VALID_COUPON, forNewUser: true })
    prisma.order.count.mockResolvedValue(2)
    const res = await POST(makeReq({ code: 'SAVE10' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/new customers/i)
  })

  it('accepts forNewUser coupon when user has no prior orders', async () => {
    getAuthUser.mockResolvedValue({ userId: 'user_1' })
    prisma.coupon.findUnique.mockResolvedValue({ ...VALID_COUPON, forNewUser: true })
    prisma.order.count.mockResolvedValue(0)
    const res = await POST(makeReq({ code: 'SAVE10' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.discount).toBe(10)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run __tests__/api/public/coupons.test.js
```

Expected: the 6 new flag tests fail (route doesn't have the flag checks yet), existing 6 pass.

- [ ] **Step 3: Implement flag enforcement in the validate route**

Replace the entire contents of `app/api/public/coupons/validate/route.js` with:

```js
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

export async function POST(req) {
  try {
    const { code } = await req.json()

    if (!code) {
      return NextResponse.json({ error: 'Coupon code is required' }, { status: 400 })
    }

    const { userId } = await getAuthUser()

    const coupon = await prisma.coupon.findUnique({
      where: { code: code.trim().toUpperCase() },
    })

    if (!coupon) {
      return NextResponse.json({ error: 'Coupon not found' }, { status: 404 })
    }

    if (new Date(coupon.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'Coupon has expired' }, { status: 400 })
    }

    if (!coupon.isPublic) {
      return NextResponse.json({ error: 'This coupon is not available' }, { status: 400 })
    }

    if (coupon.forMember && !userId) {
      return NextResponse.json({ error: 'Sign in to use this coupon' }, { status: 400 })
    }

    if (coupon.forNewUser && !userId) {
      return NextResponse.json({ error: 'Sign in to use this coupon' }, { status: 400 })
    }

    if (coupon.forNewUser && userId) {
      const orderCount = await prisma.order.count({ where: { userId } })
      if (orderCount > 0) {
        return NextResponse.json({ error: 'This coupon is for new customers only' }, { status: 400 })
      }
    }

    return NextResponse.json({
      code: coupon.code,
      discount: coupon.discount,
      description: coupon.description,
    })
  } catch (err) {
    console.error('[POST /api/public/coupons/validate]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run the tests to verify all pass**

```bash
npx vitest run __tests__/api/public/coupons.test.js
```

Expected: 12/12 passing.

- [ ] **Step 5: Run the full suite to check for regressions**

```bash
npx vitest run
```

Expected: 106 + 6 new = 112 tests passing, 0 failing.

- [ ] **Step 6: Commit**

```bash
git add app/api/public/coupons/validate/route.js __tests__/api/public/coupons.test.js
git commit -m "feat: enforce isPublic, forMember, forNewUser flags in coupon validate"
```

---

## Task 2: Orders — coupon flag re-check at placement

**Files:**
- Modify: `app/api/customer/orders/route.js`
- Modify: `__tests__/api/customer/orders.test.js`

- [ ] **Step 1: Write the failing tests**

Replace the entire contents of `__tests__/api/customer/orders.test.js` with:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  default: {
    order: { findMany: vi.fn(), create: vi.fn(), count: vi.fn() },
    product: { findMany: vi.fn() },
    coupon: { findUnique: vi.fn() },
    user: { update: vi.fn() },
    address: { findFirst: vi.fn() },
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

  it('returns 500 when Prisma throws', async () => {
    getAuthUser.mockResolvedValue(USER)
    prisma.order.findMany.mockRejectedValue(new Error('DB error'))
    const res = await GET()
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBeDefined()
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
    prisma.address.findFirst.mockResolvedValue({ id: 'addr_1' })
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

  it('returns 400 when a product is not found', async () => {
    getAuthUser.mockResolvedValue(USER)
    prisma.product.findMany.mockResolvedValue([])
    const res = await POST(makeReq({ addressId: 'addr_1', items: [{ productId: 'nonexistent', quantity: 1 }] }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/not found/i)
  })

  it('returns 404 when address does not belong to user', async () => {
    getAuthUser.mockResolvedValue(USER)
    prisma.product.findMany.mockResolvedValue([PRODUCT])
    prisma.address.findFirst.mockResolvedValue(null)
    const res = await POST(makeReq({ addressId: 'addr_other', items: [{ productId: 'prod_1', quantity: 1 }] }))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toMatch(/address/i)
  })

  it('returns 400 when coupon is expired at order time', async () => {
    getAuthUser.mockResolvedValue(USER)
    prisma.product.findMany.mockResolvedValue([PRODUCT])
    prisma.address.findFirst.mockResolvedValue({ id: 'addr_1' })
    prisma.coupon.findUnique.mockResolvedValue({
      code: 'SAVE10', discount: 10, description: '10% off',
      isPublic: true, forNewUser: false, forMember: false,
      expiresAt: new Date(Date.now() - 86400000),
    })
    const res = await POST(makeReq({ addressId: 'addr_1', couponCode: 'SAVE10', items: [{ productId: 'prod_1', quantity: 1 }] }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when non-public coupon is used at order time', async () => {
    getAuthUser.mockResolvedValue(USER)
    prisma.product.findMany.mockResolvedValue([PRODUCT])
    prisma.address.findFirst.mockResolvedValue({ id: 'addr_1' })
    prisma.coupon.findUnique.mockResolvedValue({
      code: 'PRIVATE', discount: 20, description: 'Private coupon',
      isPublic: false, forNewUser: false, forMember: false,
      expiresAt: new Date(Date.now() + 86400000),
    })
    const res = await POST(makeReq({ addressId: 'addr_1', couponCode: 'PRIVATE', items: [{ productId: 'prod_1', quantity: 1 }] }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/not available/i)
  })

  it('returns 400 when forNewUser coupon used by returning customer at order time', async () => {
    getAuthUser.mockResolvedValue(USER)
    prisma.product.findMany.mockResolvedValue([PRODUCT])
    prisma.address.findFirst.mockResolvedValue({ id: 'addr_1' })
    prisma.coupon.findUnique.mockResolvedValue({
      code: 'WELCOME10', discount: 10, description: 'New user discount',
      isPublic: true, forNewUser: true, forMember: false,
      expiresAt: new Date(Date.now() + 86400000),
    })
    prisma.order.count.mockResolvedValue(3)
    const res = await POST(makeReq({ addressId: 'addr_1', couponCode: 'WELCOME10', items: [{ productId: 'prod_1', quantity: 1 }] }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/new customers/i)
  })

  it('accepts forNewUser coupon for first-time buyer at order time', async () => {
    getAuthUser.mockResolvedValue(USER)
    prisma.product.findMany.mockResolvedValue([PRODUCT])
    prisma.address.findFirst.mockResolvedValue({ id: 'addr_1' })
    prisma.coupon.findUnique.mockResolvedValue({
      code: 'WELCOME10', discount: 10, description: 'New user discount',
      isPublic: true, forNewUser: true, forMember: false,
      expiresAt: new Date(Date.now() + 86400000),
    })
    prisma.order.count.mockResolvedValue(0)
    prisma.$transaction.mockImplementation(async (fn) => fn(prisma))
    prisma.order.create.mockResolvedValue(ORDER)
    prisma.user.update.mockResolvedValue({})
    const res = await POST(makeReq({ addressId: 'addr_1', couponCode: 'WELCOME10', items: [{ productId: 'prod_1', quantity: 1 }] }))
    expect(res.status).toBe(201)
  })

  it('returns 500 when Prisma throws', async () => {
    getAuthUser.mockResolvedValue(USER)
    prisma.product.findMany.mockRejectedValue(new Error('DB error'))
    const res = await POST(makeReq({ addressId: 'addr_1', items: [{ productId: 'prod_1', quantity: 1 }] }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run __tests__/api/customer/orders.test.js
```

Expected: the 3 new coupon flag tests fail, existing 9 pass.

- [ ] **Step 3: Implement flag re-check in the orders route**

Replace the entire contents of `app/api/customer/orders/route.js` with:

```js
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

export async function GET() {
  try {
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
  } catch (err) {
    console.error('[GET /api/customer/orders]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req) {
  try {
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

    const missing = items.find(i => !productMap[i.productId])
    if (missing) {
      return NextResponse.json({ error: 'One or more products not found' }, { status: 400 })
    }

    const address = await prisma.address.findFirst({ where: { id: addressId, userId } })
    if (!address) {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 })
    }

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
      if (!coupon.isPublic) {
        return NextResponse.json({ error: 'This coupon is not available' }, { status: 400 })
      }
      if (coupon.forNewUser) {
        const orderCount = await prisma.order.count({ where: { userId } })
        if (orderCount > 0) {
          return NextResponse.json({ error: 'This coupon is for new customers only' }, { status: 400 })
        }
      }
      discountRate = coupon.discount / 100
      couponData = { code: coupon.code, discount: coupon.discount, description: coupon.description }
    }

    // Group items by store
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
  } catch (err) {
    console.error('[POST /api/customer/orders]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run the tests to verify all pass**

```bash
npx vitest run __tests__/api/customer/orders.test.js
```

Expected: 12/12 passing.

- [ ] **Step 5: Run the full suite to check for regressions**

```bash
npx vitest run
```

Expected: 115 tests passing (106 baseline + 6 from Task 1 + 3 new), 0 failing.

- [ ] **Step 6: Commit**

```bash
git add app/api/customer/orders/route.js __tests__/api/customer/orders.test.js
git commit -m "feat: re-check coupon flags (isPublic, forNewUser) at order placement"
```

---

## Task 3: Products — ratings aggregation

**Files:**
- Modify: `app/api/public/products/route.js`
- Modify: `app/api/public/products/[id]/route.js`
- Modify: `__tests__/api/public/products.test.js`

- [ ] **Step 1: Write the failing tests**

Replace the entire contents of `__tests__/api/public/products.test.js` with:

```js
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
import { GET as getById } from '@/app/api/public/products/[id]/route'
import { GET as getCategories } from '@/app/api/public/categories/route'
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

  it('only returns inStock products from active stores', async () => {
    prisma.product.findMany.mockResolvedValue([])
    prisma.product.count.mockResolvedValue(0)
    const req = new NextRequest('http://localhost/api/public/products')
    await GET(req)
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ inStock: true, store: { isActive: true } }),
      })
    )
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
      expect.objectContaining({
        where: expect.objectContaining({ category: 'Watch' }),
      })
    )
  })

  it('applies storeId filter', async () => {
    prisma.product.findMany.mockResolvedValue([])
    prisma.product.count.mockResolvedValue(0)
    const req = new NextRequest('http://localhost/api/public/products?storeId=store_1')
    await GET(req)
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ storeId: 'store_1' }),
      })
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

  it('uses default page and limit when params are non-numeric', async () => {
    prisma.product.findMany.mockResolvedValue([])
    prisma.product.count.mockResolvedValue(0)
    const req = new NextRequest('http://localhost/api/public/products?page=abc&limit=xyz')
    const res = await GET(req)
    const body = await res.json()
    expect(body.page).toBe(1)
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 12 })
    )
  })

  it('returns 500 when Prisma throws', async () => {
    prisma.product.findMany.mockRejectedValue(new Error('DB error'))
    const req = new NextRequest('http://localhost/api/public/products')
    const res = await GET(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('returns averageRating and ratingCount computed from ratings', async () => {
    prisma.product.findMany.mockResolvedValue([PRODUCT])
    prisma.product.count.mockResolvedValue(1)
    const req = new NextRequest('http://localhost/api/public/products')
    const res = await GET(req)
    const body = await res.json()
    expect(body.products[0].averageRating).toBe(4.5)
    expect(body.products[0].ratingCount).toBe(2)
  })

  it('does not include raw rating array in list response', async () => {
    prisma.product.findMany.mockResolvedValue([PRODUCT])
    prisma.product.count.mockResolvedValue(1)
    const req = new NextRequest('http://localhost/api/public/products')
    const res = await GET(req)
    const body = await res.json()
    expect(body.products[0].rating).toBeUndefined()
  })

  it('returns averageRating 0 and ratingCount 0 for products with no ratings', async () => {
    prisma.product.findMany.mockResolvedValue([{ ...PRODUCT, rating: [] }])
    prisma.product.count.mockResolvedValue(1)
    const req = new NextRequest('http://localhost/api/public/products')
    const res = await GET(req)
    const body = await res.json()
    expect(body.products[0].averageRating).toBe(0)
    expect(body.products[0].ratingCount).toBe(0)
  })
})

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

  it('returns averageRating and ratingCount alongside full rating array', async () => {
    prisma.product.findUnique.mockResolvedValue(PRODUCT)
    const req = new NextRequest('http://localhost/api/public/products/prod_1')
    const res = await getById(req, { params: Promise.resolve({ id: 'prod_1' }) })
    const body = await res.json()
    expect(body.product.averageRating).toBe(4.5)
    expect(body.product.ratingCount).toBe(2)
    expect(body.product.rating).toHaveLength(2)
  })

  it('returns averageRating 0 and ratingCount 0 for product with no ratings', async () => {
    prisma.product.findUnique.mockResolvedValue({ ...PRODUCT, rating: [] })
    const req = new NextRequest('http://localhost/api/public/products/prod_1')
    const res = await getById(req, { params: Promise.resolve({ id: 'prod_1' }) })
    const body = await res.json()
    expect(body.product.averageRating).toBe(0)
    expect(body.product.ratingCount).toBe(0)
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

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run __tests__/api/public/products.test.js
```

Expected: the 5 new aggregation tests fail, existing tests pass.

- [ ] **Step 3: Implement ratings aggregation in the products list route**

Replace the entire contents of `app/api/public/products/route.js` with:

```js
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const page  = Math.max(1, parseInt(searchParams.get('page'),  10) || 1)
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit'), 10) || 12))
  const search = searchParams.get('search') || ''
  const category = searchParams.get('category') || ''
  const storeId = searchParams.get('storeId') || ''
  const sort = searchParams.get('sort') || 'createdAt'

  const where = { inStock: true, store: { isActive: true } }
  if (search) where.name = { contains: search, mode: 'insensitive' }
  if (category) where.category = category
  if (storeId) where.storeId = storeId

  const orderBy = sort === 'ratingCount'
    ? { rating: { _count: 'desc' } }
    : { createdAt: 'desc' }

  try {
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

    const enrichedProducts = products.map(({ rating, ...product }) => ({
      ...product,
      ratingCount: rating.length,
      averageRating: rating.length
        ? Math.round((rating.reduce((sum, r) => sum + r.rating, 0) / rating.length) * 10) / 10
        : 0,
    }))

    return NextResponse.json({
      products: enrichedProducts,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  } catch (err) {
    console.error('[GET /api/public/products]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Implement ratings aggregation in the product detail route**

Replace the entire contents of `app/api/public/products/[id]/route.js` with:

```js
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(req, { params }) {
  try {
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

    const ratingCount = product.rating.length
    const averageRating = ratingCount
      ? Math.round((product.rating.reduce((sum, r) => sum + r.rating, 0) / ratingCount) * 10) / 10
      : 0

    return NextResponse.json({ product: { ...product, averageRating, ratingCount } })
  } catch (err) {
    console.error('[GET /api/public/products/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 5: Run the tests to verify all pass**

```bash
npx vitest run __tests__/api/public/products.test.js
```

Expected: 17/17 passing.

- [ ] **Step 6: Run the full suite to verify no regressions**

```bash
npx vitest run
```

Expected: all tests passing, 0 failing. Total should be 106 + 6 (Task 1) + 3 (Task 2) + 5 (Task 3) = 120 tests.

- [ ] **Step 7: Commit**

```bash
git add app/api/public/products/route.js app/api/public/products/[id]/route.js __tests__/api/public/products.test.js
git commit -m "feat: add averageRating and ratingCount to product API responses"
```

---

## Task 4: Mark Phase 5 complete in CONTEXT.md

**Files:**
- Modify: `CONTEXT.md`

- [ ] **Step 1: Update CONTEXT.md**

In `CONTEXT.md`, make these changes:

1. Change Phase 5 status from `🔄 In progress` to `✅ Complete`

2. Update the "Current phase" line to:
   ```
   **Current phase:** Phase 5 — Platform Services ✅ Complete — all phases done
   ```

3. Update "Last session ended" to:
   ```
   **Last session ended:** 2026-06-12 — Phase 5 complete. Coupon flag enforcement (isPublic, forMember, forNewUser) in validate + orders routes. On-the-fly averageRating/ratingCount aggregation in products list + detail routes. 120/120 tests passing.
   ```

4. Update "Immediate next step" to:
   ```
   **Immediate next step:** All 5 phases complete. Platform is feature-complete for v1. Consider: manual end-to-end testing, VPS deployment, or starting v2 features (Stripe, analytics, email notifications).
   ```

5. Add Phase 5 checklist after the Phase 4 checklist:
   ```markdown
   ## Phase 5 Checklist ✅ Complete — Platform Services

   - [x] Task 1 — `app/api/public/coupons/validate/route.js` — enforce isPublic, forMember, forNewUser flags; auth-aware via getAuthUser()
   - [x] Task 2 — `app/api/customer/orders/route.js` — re-check isPublic and forNewUser at order placement as security backstop
   - [x] Task 3 — `app/api/public/products/route.js` — compute averageRating + ratingCount, strip raw rating array from list response
   - [x] Task 3 — `app/api/public/products/[id]/route.js` — compute averageRating + ratingCount, keep full rating array in detail response
   - [x] Tests — 120/120 passing (added 14 new tests across 3 test files)
   ```

6. Update the "Codebase state" bullet for tests:
   ```
   - **120 tests passing** — all Phase 1-5 routes covered
   ```

- [ ] **Step 2: Commit**

```bash
git add CONTEXT.md
git commit -m "docs: mark Phase 5 complete in CONTEXT.md — all phases done, 120 tests passing"
```
