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
