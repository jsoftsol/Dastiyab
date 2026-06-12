import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

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
