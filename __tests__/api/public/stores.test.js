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
