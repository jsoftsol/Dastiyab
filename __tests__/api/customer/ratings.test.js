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

  it('returns 500 when Prisma throws', async () => {
    getAuthUser.mockResolvedValue(USER)
    prisma.order.findUnique.mockRejectedValue(new Error('DB error'))
    const res = await POST(makeReq({ orderId: 'order_1', productId: 'prod_1', rating: 4 }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })
})
