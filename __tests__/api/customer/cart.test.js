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
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.cart).toEqual({})
  })

  it('returns DB cart for authenticated user', async () => {
    getAuthUser.mockResolvedValue(USER)
    prisma.user.findUnique.mockResolvedValue({ cart: { prod_1: 2 } })
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.cart).toEqual({ prod_1: 2 })
  })

  it('returns 500 when Prisma throws', async () => {
    getAuthUser.mockResolvedValue(USER)
    prisma.user.findUnique.mockRejectedValue(new Error('DB error'))
    const res = await GET()
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBeDefined()
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

  it('returns 400 when cart is invalid', async () => {
    getAuthUser.mockResolvedValue(USER)
    const req = new NextRequest('http://localhost/api/customer/cart', {
      method: 'PUT',
      body: JSON.stringify({ cart: null }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PUT(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('returns 500 when Prisma throws', async () => {
    getAuthUser.mockResolvedValue(USER)
    prisma.user.update.mockRejectedValue(new Error('DB error'))
    const req = new NextRequest('http://localhost/api/customer/cart', {
      method: 'PUT',
      body: JSON.stringify({ cart: {} }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PUT(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })
})
