import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const { userId } = await getAuthUser()
    if (!userId) return NextResponse.json({ store: null })

    const store = await prisma.store.findFirst({
      where: { userId },
      select: { id: true, name: true, status: true, isActive: true },
    })

    return NextResponse.json({ store: store ?? null })
  } catch (err) {
    console.error('[GET /api/customer/store]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
