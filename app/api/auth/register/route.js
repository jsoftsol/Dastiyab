import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'

export async function POST(req) {
  const { name, email, password } = await req.json()

  if (!name || !email || !password) {
    return NextResponse.json(
      { error: 'Name, email and password are required' },
      { status: 400 }
    )
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json(
      { error: 'Email already registered' },
      { status: 400 }
    )
  }

  const hash = await bcrypt.hash(password, 12)
  await prisma.user.create({
    data: { name, email, password: hash, role: 'customer' },
  })

  return NextResponse.json({ success: true })
}
