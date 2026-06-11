import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  requireAdmin: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    store: { update: vi.fn() },
    coupon: { create: vi.fn(), delete: vi.fn() },
    order: { update: vi.fn() },
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { requireAdmin } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import {
  toggleStoreActive,
  approveStore,
  createCoupon,
  deleteCoupon,
  updateOrderStatus,
} from '@/app/admin/actions'

beforeEach(() => vi.clearAllMocks())

describe('toggleStoreActive', () => {
  it('returns error when not admin', async () => {
    requireAdmin.mockResolvedValue(null)
    const result = await toggleStoreActive('store_1', true)
    expect(result).toEqual({ error: 'Unauthorized' })
    expect(prisma.store.update).not.toHaveBeenCalled()
  })

  it('updates isActive and revalidates', async () => {
    requireAdmin.mockResolvedValue({ userId: 'u1', role: 'admin' })
    await toggleStoreActive('store_1', false)
    expect(prisma.store.update).toHaveBeenCalledWith({
      where: { id: 'store_1' },
      data: { isActive: false },
    })
    expect(revalidatePath).toHaveBeenCalledWith('/admin/stores')
  })
})

describe('approveStore', () => {
  it('returns error when not admin', async () => {
    requireAdmin.mockResolvedValue(null)
    expect(await approveStore('store_1', 'approved')).toEqual({ error: 'Unauthorized' })
  })

  it('sets status and isActive:true when approving', async () => {
    requireAdmin.mockResolvedValue({ userId: 'u1', role: 'admin' })
    await approveStore('store_1', 'approved')
    expect(prisma.store.update).toHaveBeenCalledWith({
      where: { id: 'store_1' },
      data: { status: 'approved', isActive: true },
    })
    expect(revalidatePath).toHaveBeenCalledWith('/admin/approve')
  })

  it('sets status only (no isActive) when rejecting', async () => {
    requireAdmin.mockResolvedValue({ userId: 'u1', role: 'admin' })
    await approveStore('store_1', 'rejected')
    expect(prisma.store.update).toHaveBeenCalledWith({
      where: { id: 'store_1' },
      data: { status: 'rejected' },
    })
  })

  it('returns error for invalid status', async () => {
    requireAdmin.mockResolvedValue({ userId: 'u1', role: 'admin' })
    const result = await approveStore('store_1', 'INVALID')
    expect(result).toEqual({ error: 'Invalid status' })
    expect(prisma.store.update).not.toHaveBeenCalled()
  })
})

describe('createCoupon', () => {
  const couponData = {
    code: 'SAVE10', description: 'Test coupon', discount: '10',
    expiresAt: '2027-01-01', forNewUser: false, forMember: false, isPublic: true,
  }

  it('returns error when not admin', async () => {
    requireAdmin.mockResolvedValue(null)
    expect(await createCoupon(couponData)).toEqual({ error: 'Unauthorized' })
    expect(prisma.coupon.create).not.toHaveBeenCalled()
  })

  it('creates coupon with parsed types and revalidates', async () => {
    requireAdmin.mockResolvedValue({ userId: 'u1', role: 'admin' })
    await createCoupon(couponData)
    expect(prisma.coupon.create).toHaveBeenCalledWith({
      data: {
        code: 'SAVE10',
        description: 'Test coupon',
        discount: 10,
        expiresAt: new Date('2027-01-01'),
        forNewUser: false,
        forMember: false,
        isPublic: true,
      },
    })
    expect(revalidatePath).toHaveBeenCalledWith('/admin/coupons')
  })
})

describe('deleteCoupon', () => {
  it('returns error when not admin', async () => {
    requireAdmin.mockResolvedValue(null)
    expect(await deleteCoupon('SAVE10')).toEqual({ error: 'Unauthorized' })
  })

  it('deletes coupon and revalidates', async () => {
    requireAdmin.mockResolvedValue({ userId: 'u1', role: 'admin' })
    await deleteCoupon('SAVE10')
    expect(prisma.coupon.delete).toHaveBeenCalledWith({ where: { code: 'SAVE10' } })
    expect(revalidatePath).toHaveBeenCalledWith('/admin/coupons')
  })
})

describe('updateOrderStatus', () => {
  it('returns error when not admin', async () => {
    requireAdmin.mockResolvedValue(null)
    expect(await updateOrderStatus('order_1', 'PROCESSING')).toEqual({ error: 'Unauthorized' })
  })

  it('updates status and revalidates', async () => {
    requireAdmin.mockResolvedValue({ userId: 'u1', role: 'admin' })
    await updateOrderStatus('order_1', 'SHIPPED')
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order_1' },
      data: { status: 'SHIPPED' },
    })
    expect(revalidatePath).toHaveBeenCalledWith('/admin/orders')
  })

  it('returns error for invalid status', async () => {
    requireAdmin.mockResolvedValue({ userId: 'u1', role: 'admin' })
    const result = await updateOrderStatus('order_1', 'INVALID_STATUS')
    expect(result).toEqual({ error: 'Invalid status' })
    expect(prisma.order.update).not.toHaveBeenCalled()
  })
})
