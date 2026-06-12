import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function POST(req) {
  try {
    const { userId } = await getAuthUser()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { name, username, description, email, contact, address, logo } = await req.json()

    if (!name || !username || !description || !email || !contact || !address) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    // Check username uniqueness
    const existing = await prisma.store.findUnique({ where: { username } })
    if (existing) return NextResponse.json({ error: 'Username already taken' }, { status: 409 })

    // Check user doesn't already have a store
    const userStore = await prisma.store.findFirst({ where: { userId } })
    if (userStore) return NextResponse.json({ error: 'You already have a store' }, { status: 409 })

    const store = await prisma.store.create({
      data: {
        userId,
        name,
        username,
        description,
        email,
        contact,
        address,
        logo: logo || '',
        status: 'pending',
        isActive: false,
      },
    })

    // Update user role to vendor
    await prisma.user.update({
      where: { id: userId },
      data: { role: 'vendor' },
    })

    return NextResponse.json({ store }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/public/stores]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
