'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { requireVendor } from '@/lib/auth'

const VALID_ORDER_STATUSES = ['ORDER_PLACED', 'PROCESSING', 'SHIPPED', 'DELIVERED']

async function getVendorStore(userId) {
  return prisma.store.findUnique({ where: { userId } })
}

export async function createProduct(productData) {
  const vendor = await requireVendor()
  if (!vendor) return { error: 'Unauthorized' }

  const store = await getVendorStore(vendor.userId)
  if (!store) return { error: 'Store not found' }

  try {
    await prisma.product.create({
      data: {
        name: productData.name,
        description: productData.description,
        mrp: parseFloat(productData.mrp),
        price: parseFloat(productData.price),
        category: productData.category,
        images: productData.images,
        storeId: store.id,
      },
    })
  } catch {
    return { error: 'Failed to create product' }
  }

  revalidatePath('/store/manage-product')
}

export async function updateProduct(productId, data) {
  const vendor = await requireVendor()
  if (!vendor) return { error: 'Unauthorized' }

  const store = await getVendorStore(vendor.userId)
  if (!store) return { error: 'Store not found' }

  const product = await prisma.product.findUnique({ where: { id: productId } })
  if (!product || product.storeId !== store.id) return { error: 'Forbidden' }

  try {
    await prisma.product.update({
      where: { id: productId },
      data: {
        name: data.name,
        description: data.description,
        mrp: parseFloat(data.mrp),
        price: parseFloat(data.price),
        category: data.category,
        images: data.images,
      },
    })
  } catch {
    return { error: 'Failed to update product' }
  }

  revalidatePath('/store/manage-product')
}

export async function deleteProduct(productId) {
  const vendor = await requireVendor()
  if (!vendor) return { error: 'Unauthorized' }

  const store = await getVendorStore(vendor.userId)
  if (!store) return { error: 'Store not found' }

  const product = await prisma.product.findUnique({ where: { id: productId } })
  if (!product || product.storeId !== store.id) return { error: 'Forbidden' }

  try {
    await prisma.product.delete({ where: { id: productId } })
  } catch {
    return { error: 'Failed to delete product' }
  }

  revalidatePath('/store/manage-product')
}

export async function toggleInStock(productId, inStock) {
  const vendor = await requireVendor()
  if (!vendor) return { error: 'Unauthorized' }

  const store = await getVendorStore(vendor.userId)
  if (!store) return { error: 'Store not found' }

  const product = await prisma.product.findUnique({ where: { id: productId } })
  if (!product || product.storeId !== store.id) return { error: 'Forbidden' }

  try {
    await prisma.product.update({ where: { id: productId }, data: { inStock } })
  } catch {
    return { error: 'Failed to update product' }
  }

  revalidatePath('/store/manage-product')
}

export async function updateOrderStatus(orderId, status) {
  const vendor = await requireVendor()
  if (!vendor) return { error: 'Unauthorized' }

  if (!VALID_ORDER_STATUSES.includes(status)) return { error: 'Invalid status' }

  const store = await getVendorStore(vendor.userId)
  if (!store) return { error: 'Store not found' }

  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order || order.storeId !== store.id) return { error: 'Forbidden' }

  try {
    await prisma.order.update({ where: { id: orderId }, data: { status } })
  } catch {
    return { error: 'Failed to update order' }
  }

  revalidatePath('/store/orders')
}
