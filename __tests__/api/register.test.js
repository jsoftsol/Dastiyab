import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST as registerPOST } from '@/app/api/auth/register/route'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}))

import prisma from '@/lib/prisma'

describe('POST /api/auth/register', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when fields are missing', async () => {
    const req = new NextRequest('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'a@b.com' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await registerPOST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('returns 400 when email already exists', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'existing' })
    const req = new NextRequest('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'Chad', email: 'chad@test.com', password: 'pass123' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await registerPOST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/already/i)
  })

  it('creates user and returns success', async () => {
    prisma.user.findUnique.mockResolvedValue(null)
    prisma.user.create.mockResolvedValue({ id: 'new-user' })
    const req = new NextRequest('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'Chad', email: 'chad@test.com', password: 'pass123' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await registerPOST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: 'customer', email: 'chad@test.com' }),
      })
    )
  })
})
