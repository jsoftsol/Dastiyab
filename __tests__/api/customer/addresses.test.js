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

  it('returns 500 when Prisma throws', async () => {
    getAuthUser.mockResolvedValue(USER)
    prisma.address.findMany.mockRejectedValue(new Error('DB error'))
    const res = await GET()
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBeDefined()
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

  it('returns 500 when Prisma throws', async () => {
    getAuthUser.mockResolvedValue(USER)
    prisma.address.create.mockRejectedValue(new Error('DB error'))
    const req = new NextRequest('http://localhost/api/customer/addresses', {
      method: 'POST',
      body: JSON.stringify({ name: 'Home', email: 'user@test.com', street: '123 Main St', city: 'Karachi', state: 'Sindh', zip: '75000', country: 'Pakistan', phone: '03001234567' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBeDefined()
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

  it('returns 500 when Prisma throws', async () => {
    getAuthUser.mockResolvedValue(USER)
    prisma.address.findUnique.mockRejectedValue(new Error('DB error'))
    const req = new NextRequest('http://localhost/api/customer/addresses/addr_1', { method: 'DELETE' })
    const res = await DELETE(req, { params: Promise.resolve({ id: 'addr_1' }) })
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })
})
