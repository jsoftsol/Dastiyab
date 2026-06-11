import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

import { auth } from '@/auth'
import { requireAdmin, requireVendor, getAuthUser } from '@/lib/auth'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('requireAdmin', () => {
  it('returns null when unauthenticated', async () => {
    auth.mockResolvedValue(null)
    expect(await requireAdmin()).toBeNull()
  })

  it('returns null when user has vendor role', async () => {
    auth.mockResolvedValue({ user: { id: 'user_123', role: 'vendor' } })
    expect(await requireAdmin()).toBeNull()
  })

  it('returns user data when user has admin role', async () => {
    auth.mockResolvedValue({ user: { id: 'user_123', role: 'admin' } })
    const result = await requireAdmin()
    expect(result).toEqual({ userId: 'user_123', role: 'admin' })
  })
})

describe('requireVendor', () => {
  it('returns null when unauthenticated', async () => {
    auth.mockResolvedValue(null)
    expect(await requireVendor()).toBeNull()
  })

  it('returns null when user has admin role', async () => {
    auth.mockResolvedValue({ user: { id: 'user_123', role: 'admin' } })
    expect(await requireVendor()).toBeNull()
  })

  it('returns user data when user has vendor role', async () => {
    auth.mockResolvedValue({ user: { id: 'user_123', role: 'vendor' } })
    const result = await requireVendor()
    expect(result).toEqual({ userId: 'user_123', role: 'vendor' })
  })
})

describe('getAuthUser', () => {
  it('returns null userId and null role when unauthenticated', async () => {
    auth.mockResolvedValue(null)
    const result = await getAuthUser()
    expect(result).toEqual({ userId: null, role: null })
  })

  it('returns userId and role when authenticated', async () => {
    auth.mockResolvedValue({ user: { id: 'user_456', role: 'customer' } })
    const result = await getAuthUser()
    expect(result).toEqual({ userId: 'user_456', role: 'customer' })
  })
})
