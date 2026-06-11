'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

const VALID_ORDER_STATUSES = ['ORDER_PLACED', 'PROCESSING', 'SHIPPED', 'DELIVERED']
const VALID_STORE_STATUSES = ['approved', 'rejected', 'pending']

export async function toggleStoreActive(storeId, isActive) {
  const admin = await requireAdmin()
  if (!admin) return { error: 'Unauthorized' }

  try {
    await prisma.store.update({
      where: { id: storeId },
      data: { isActive },
    })
  } catch {
    return { error: 'Store not found' }
  }

  revalidatePath('/admin/stores')
}

export async function approveStore(storeId, status) {
  const admin = await requireAdmin()
  if (!admin) return { error: 'Unauthorized' }

  if (!VALID_STORE_STATUSES.includes(status)) return { error: 'Invalid status' }

  try {
    await prisma.store.update({
      where: { id: storeId },
      data: {
        status,
        ...(status === 'approved' && { isActive: true }),
      },
    })
  } catch {
    return { error: 'Store not found' }
  }

  revalidatePath('/admin/approve')
}

export async function createCoupon(couponData) {
  const admin = await requireAdmin()
  if (!admin) return { error: 'Unauthorized' }

  try {
    await prisma.coupon.create({
      data: {
        code: couponData.code,
        description: couponData.description,
        discount: parseFloat(couponData.discount),
        expiresAt: new Date(couponData.expiresAt),
        forNewUser: Boolean(couponData.forNewUser),
        forMember: Boolean(couponData.forMember),
        isPublic: Boolean(couponData.isPublic),
      },
    })
  } catch {
    return { error: 'Failed to create coupon — code may already exist' }
  }

  revalidatePath('/admin/coupons')
}

export async function deleteCoupon(code) {
  const admin = await requireAdmin()
  if (!admin) return { error: 'Unauthorized' }

  try {
    await prisma.coupon.delete({ where: { code } })
  } catch {
    return { error: 'Coupon not found' }
  }

  revalidatePath('/admin/coupons')
}

export async function updateOrderStatus(orderId, status) {
  const admin = await requireAdmin()
  if (!admin) return { error: 'Unauthorized' }

  if (!VALID_ORDER_STATUSES.includes(status)) return { error: 'Invalid status' }

  try {
    await prisma.order.update({
      where: { id: orderId },
      data: { status },
    })
  } catch {
    return { error: 'Order not found' }
  }

  revalidatePath('/admin/orders')
}
