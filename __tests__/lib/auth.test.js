import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}))

import { auth } from '@clerk/nextjs/server'
import { requireAdmin, requireVendor, getAuthUser } from '@/lib/auth'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('requireAdmin', () => {
  it('returns null when unauthenticated', async () => {
    auth.mockResolvedValue({ userId: null, sessionClaims: null })
    expect(await requireAdmin()).toBeNull()
  })

  it('returns null when user has vendor role', async () => {
    auth.mockResolvedValue({
      userId: 'user_123',
      sessionClaims: { metadata: { role: 'vendor' } },
    })
    expect(await requireAdmin()).toBeNull()
  })

  it('returns session data when user has admin role', async () => {
    auth.mockResolvedValue({
      userId: 'user_123',
      sessionClaims: { metadata: { role: 'admin' } },
    })
    const result = await requireAdmin()
    expect(result).toEqual({
      userId: 'user_123',
      sessionClaims: { metadata: { role: 'admin' } },
    })
  })
})

describe('requireVendor', () => {
  it('returns null when unauthenticated', async () => {
    auth.mockResolvedValue({ userId: null, sessionClaims: null })
    expect(await requireVendor()).toBeNull()
  })

  it('returns null when user has admin role', async () => {
    auth.mockResolvedValue({
      userId: 'user_123',
      sessionClaims: { metadata: { role: 'admin' } },
    })
    expect(await requireVendor()).toBeNull()
  })

  it('returns session data when user has vendor role', async () => {
    auth.mockResolvedValue({
      userId: 'user_123',
      sessionClaims: { metadata: { role: 'vendor' } },
    })
    const result = await requireVendor()
    expect(result).toEqual({
      userId: 'user_123',
      sessionClaims: { metadata: { role: 'vendor' } },
    })
  })
})

describe('getAuthUser', () => {
  it('returns null userId and null role when unauthenticated', async () => {
    auth.mockResolvedValue({ userId: null, sessionClaims: null })
    const result = await getAuthUser()
    expect(result).toEqual({ userId: null, role: null })
  })

  it('returns userId and role when authenticated', async () => {
    auth.mockResolvedValue({
      userId: 'user_456',
      sessionClaims: { metadata: { role: 'customer' } },
    })
    const result = await getAuthUser()
    expect(result).toEqual({ userId: 'user_456', role: 'customer' })
  })
})
