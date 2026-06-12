import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

export async function DELETE(req, { params }) {
  try {
    const { id } = await params
    const { userId } = await getAuthUser()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const address = await prisma.address.findUnique({ where: { id } })
    if (!address || address.userId !== userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await prisma.address.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/customer/addresses/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
