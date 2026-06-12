import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

export async function GET() {
  try {
    const { userId } = await getAuthUser()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const addresses = await prisma.address.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ addresses })
  } catch (err) {
    console.error('[GET /api/customer/addresses]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req) {
  try {
    const { userId } = await getAuthUser()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { name, email, street, city, state, zip, country, phone } = await req.json()

    if (!name || !email || !street || !city || !state || !zip || !country || !phone) {
      return NextResponse.json({ error: 'All address fields are required' }, { status: 400 })
    }

    const address = await prisma.address.create({
      data: { userId, name, email, street, city, state, zip, country, phone },
    })

    return NextResponse.json({ address }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/customer/addresses]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
