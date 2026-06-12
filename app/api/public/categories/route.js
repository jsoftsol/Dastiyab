import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const rows = await prisma.product.findMany({
      where: { inStock: true, store: { isActive: true } },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    })
    return NextResponse.json({ categories: rows.map(r => r.category) })
  } catch (err) {
    console.error('[GET /api/public/categories]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
