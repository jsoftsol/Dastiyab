import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

export async function GET() {
  try {
    const { userId } = await getAuthUser()
    if (!userId) return NextResponse.json({ cart: {} })

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { cart: true },
    })

    return NextResponse.json({ cart: user?.cart || {} })
  } catch (err) {
    console.error('[GET /api/customer/cart]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(req) {
  try {
    const { userId } = await getAuthUser()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { cart } = await req.json()

    await prisma.user.update({
      where: { id: userId },
      data: { cart },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[PUT /api/customer/cart]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
