import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

export async function POST(req) {
  try {
    const { userId } = await getAuthUser()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { orderId, productId, rating, review } = await req.json()

    if (!orderId || !productId || !rating) {
      return NextResponse.json({ error: 'orderId, productId, and rating are required' }, { status: 400 })
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 })
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } })
    if (!order || order.userId !== userId) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.status !== 'DELIVERED') {
      return NextResponse.json({ error: 'Can only rate delivered orders' }, { status: 400 })
    }

    const existing = await prisma.rating.findUnique({
      where: { userId_productId_orderId: { userId, productId, orderId } },
    })
    if (existing) {
      return NextResponse.json({ error: 'Already rated this product for this order' }, { status: 400 })
    }

    const newRating = await prisma.rating.create({
      data: { userId, productId, orderId, rating, review: review || '' },
    })

    return NextResponse.json({ rating: newRating }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/customer/ratings]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
