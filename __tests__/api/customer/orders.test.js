import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  default: {
    order: { findMany: vi.fn(), create: vi.fn() },
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
    prisma.product.findMany.mockResolvedValue([]) // empty — product not found
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
      expiresAt: new Date(Date.now() - 86400000),
    })
    const res = await POST(makeReq({ addressId: 'addr_1', couponCode: 'SAVE10', items: [{ productId: 'prod_1', quantity: 1 }] }))
    expect(res.status).toBe(400)
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
