import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(req, { params }) {
  try {
    const { username } = await params
    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page'), 10) || 1)
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit'), 10) || 12))

    const storeRecord = await prisma.store.findUnique({
      where: { username },
      select: {
        id: true, name: true, username: true, description: true,
        address: true, logo: true, email: true, contact: true,
        createdAt: true, updatedAt: true,
        status: true, isActive: true,
      },
    })

    if (!storeRecord || storeRecord.status !== 'approved' || !storeRecord.isActive) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    // Strip internal fields before returning to client
    const { status, isActive, ...store } = storeRecord

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where: { storeId: store.id, inStock: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          store: { select: { id: true, name: true, username: true, logo: true } },
          rating: { select: { rating: true } },
        },
      }),
      prisma.product.count({ where: { storeId: store.id, inStock: true } }),
    ])

    return NextResponse.json({
      store,
      products,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  } catch (err) {
    console.error('[GET /api/public/stores/[username]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
