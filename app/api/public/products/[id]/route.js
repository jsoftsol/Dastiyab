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
