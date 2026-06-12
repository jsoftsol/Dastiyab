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
