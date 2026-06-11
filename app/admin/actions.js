'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export async function toggleStoreActive(storeId, isActive) {
  const admin = await requireAdmin()
  if (!admin) return { error: 'Unauthorized' }

  await prisma.store.update({
    where: { id: storeId },
    data: { isActive },
  })

  revalidatePath('/admin/stores')
}

export async function approveStore(storeId, status) {
  const admin = await requireAdmin()
  if (!admin) return { error: 'Unauthorized' }

  await prisma.store.update({
    where: { id: storeId },
    data: {
      status,
      ...(status === 'approved' && { isActive: true }),
    },
  })

  revalidatePath('/admin/approve')
}

export async function createCoupon(couponData) {
  const admin = await requireAdmin()
  if (!admin) return { error: 'Unauthorized' }

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

  revalidatePath('/admin/coupons')
}

export async function deleteCoupon(code) {
  const admin = await requireAdmin()
  if (!admin) return { error: 'Unauthorized' }

  await prisma.coupon.delete({ where: { code } })

  revalidatePath('/admin/coupons')
}

export async function updateOrderStatus(orderId, status) {
  const admin = await requireAdmin()
  if (!admin) return { error: 'Unauthorized' }

  await prisma.order.update({
    where: { id: orderId },
    data: { status },
  })

  revalidatePath('/admin/orders')
}
