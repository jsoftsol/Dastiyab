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
