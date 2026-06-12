import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

export async function POST(req) {
  try {
    const { code } = await req.json()

    if (!code) {
      return NextResponse.json({ error: 'Coupon code is required' }, { status: 400 })
    }

    const coupon = await prisma.coupon.findUnique({
      where: { code: code.trim().toUpperCase() },
    })

    if (!coupon) {
      return NextResponse.json({ error: 'Coupon not found' }, { status: 404 })
    }

    if (new Date(coupon.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'Coupon has expired' }, { status: 400 })
    }

    const { userId } = await getAuthUser()

    if (!coupon.isPublic) {
      return NextResponse.json({ error: 'This coupon is not available' }, { status: 400 })
    }

    if (coupon.forMember && !userId) {
      return NextResponse.json({ error: 'Sign in to use this coupon' }, { status: 400 })
    }

    if (coupon.forNewUser) {
      if (!userId) {
        return NextResponse.json({ error: 'Sign in to use this coupon' }, { status: 400 })
      }
      // platform-wide: forNewUser means first order ever across all stores
      const orderCount = await prisma.order.count({ where: { userId } })
      if (orderCount > 0) {
        return NextResponse.json({ error: 'This coupon is for new customers only' }, { status: 400 })
      }
    }

    return NextResponse.json({
      code: coupon.code,
      discount: coupon.discount,
      description: coupon.description,
    })
  } catch (err) {
    console.error('[POST /api/public/coupons/validate]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
