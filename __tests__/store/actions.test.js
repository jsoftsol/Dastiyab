import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  requireVendor: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    store: { findUnique: vi.fn() },
    product: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    order: { findUnique: vi.fn(), update: vi.fn() },
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { requireVendor } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import {
  createProduct,
  updateProduct,
  deleteProduct,
  toggleInStock,
  updateOrderStatus,
} from '@/app/store/actions'

const VENDOR = { userId: 'user_1', role: 'vendor' }
const STORE = { id: 'store_1', userId: 'user_1' }
const PRODUCT = { id: 'prod_1', storeId: 'store_1', name: 'Test', description: 'Desc', mrp: 100, price: 80, images: [], category: 'Electronics', inStock: true }
const ORDER = { id: 'order_1', storeId: 'store_1', status: 'ORDER_PLACED' }

beforeEach(() => vi.clearAllMocks())

describe('createProduct', () => {
  it('returns error when not vendor', async () => {
    requireVendor.mockResolvedValue(null)
    const result = await createProduct({ name: 'x', description: 'x', mrp: '10', price: '8', category: 'Electronics', images: [] })
    expect(result).toEqual({ error: 'Unauthorized' })
    expect(prisma.product.create).not.toHaveBeenCalled()
  })

  it('creates product with storeId from session and revalidates', async () => {
    requireVendor.mockResolvedValue(VENDOR)
    prisma.store.findUnique.mockResolvedValue(STORE)
    await createProduct({ name: 'Shoe', description: 'Nice shoe', mrp: '100', price: '80', category: 'Clothing', images: ['https://url.com/img.jpg'] })
    expect(prisma.product.create).toHaveBeenCalledWith({
      data: {
        name: 'Shoe',
        description: 'Nice shoe',
        mrp: 100,
        price: 80,
        category: 'Clothing',
        images: ['https://url.com/img.jpg'],
        storeId: 'store_1',
      },
    })
    expect(revalidatePath).toHaveBeenCalledWith('/store/manage-product')
  })
})

describe('updateProduct', () => {
  it('returns error when not vendor', async () => {
    requireVendor.mockResolvedValue(null)
    expect(await updateProduct('prod_1', {})).toEqual({ error: 'Unauthorized' })
  })

  it('returns Forbidden when product belongs to different store', async () => {
    requireVendor.mockResolvedValue(VENDOR)
    prisma.store.findUnique.mockResolvedValue(STORE)
    prisma.product.findUnique.mockResolvedValue({ ...PRODUCT, storeId: 'other_store' })
    expect(await updateProduct('prod_1', {})).toEqual({ error: 'Forbidden' })
    expect(prisma.product.update).not.toHaveBeenCalled()
  })

  it('updates product and revalidates', async () => {
    requireVendor.mockResolvedValue(VENDOR)
    prisma.store.findUnique.mockResolvedValue(STORE)
    prisma.product.findUnique.mockResolvedValue(PRODUCT)
    await updateProduct('prod_1', { name: 'New', description: 'New desc', mrp: '120', price: '90', category: 'Electronics', images: ['https://url.com/new.jpg'] })
    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: 'prod_1' },
      data: { name: 'New', description: 'New desc', mrp: 120, price: 90, category: 'Electronics', images: ['https://url.com/new.jpg'] },
    })
    expect(revalidatePath).toHaveBeenCalledWith('/store/manage-product')
  })
})

describe('deleteProduct', () => {
  it('returns error when not vendor', async () => {
    requireVendor.mockResolvedValue(null)
    expect(await deleteProduct('prod_1')).toEqual({ error: 'Unauthorized' })
  })

  it('returns Forbidden when product belongs to different store', async () => {
    requireVendor.mockResolvedValue(VENDOR)
    prisma.store.findUnique.mockResolvedValue(STORE)
    prisma.product.findUnique.mockResolvedValue({ ...PRODUCT, storeId: 'other_store' })
    expect(await deleteProduct('prod_1')).toEqual({ error: 'Forbidden' })
    expect(prisma.product.delete).not.toHaveBeenCalled()
  })

  it('deletes product and revalidates', async () => {
    requireVendor.mockResolvedValue(VENDOR)
    prisma.store.findUnique.mockResolvedValue(STORE)
    prisma.product.findUnique.mockResolvedValue(PRODUCT)
    await deleteProduct('prod_1')
    expect(prisma.product.delete).toHaveBeenCalledWith({ where: { id: 'prod_1' } })
    expect(revalidatePath).toHaveBeenCalledWith('/store/manage-product')
  })
})

describe('toggleInStock', () => {
  it('returns error when not vendor', async () => {
    requireVendor.mockResolvedValue(null)
    expect(await toggleInStock('prod_1', false)).toEqual({ error: 'Unauthorized' })
  })

  it('returns Forbidden when product belongs to different store', async () => {
    requireVendor.mockResolvedValue(VENDOR)
    prisma.store.findUnique.mockResolvedValue(STORE)
    prisma.product.findUnique.mockResolvedValue({ ...PRODUCT, storeId: 'other_store' })
    expect(await toggleInStock('prod_1', false)).toEqual({ error: 'Forbidden' })
    expect(prisma.product.update).not.toHaveBeenCalled()
  })

  it('updates inStock and revalidates', async () => {
    requireVendor.mockResolvedValue(VENDOR)
    prisma.store.findUnique.mockResolvedValue(STORE)
    prisma.product.findUnique.mockResolvedValue(PRODUCT)
    await toggleInStock('prod_1', false)
    expect(prisma.product.update).toHaveBeenCalledWith({ where: { id: 'prod_1' }, data: { inStock: false } })
    expect(revalidatePath).toHaveBeenCalledWith('/store/manage-product')
  })
})

describe('updateOrderStatus', () => {
  it('returns error when not vendor', async () => {
    requireVendor.mockResolvedValue(null)
    expect(await updateOrderStatus('order_1', 'PROCESSING')).toEqual({ error: 'Unauthorized' })
  })

  it('returns error for invalid status', async () => {
    requireVendor.mockResolvedValue(VENDOR)
    prisma.store.findUnique.mockResolvedValue(STORE)
    expect(await updateOrderStatus('order_1', 'INVALID')).toEqual({ error: 'Invalid status' })
    expect(prisma.order.update).not.toHaveBeenCalled()
  })

  it('returns Forbidden when order belongs to different store', async () => {
    requireVendor.mockResolvedValue(VENDOR)
    prisma.store.findUnique.mockResolvedValue(STORE)
    prisma.order.findUnique.mockResolvedValue({ ...ORDER, storeId: 'other_store' })
    expect(await updateOrderStatus('order_1', 'SHIPPED')).toEqual({ error: 'Forbidden' })
    expect(prisma.order.update).not.toHaveBeenCalled()
  })

  it('updates order status and revalidates', async () => {
    requireVendor.mockResolvedValue(VENDOR)
    prisma.store.findUnique.mockResolvedValue(STORE)
    prisma.order.findUnique.mockResolvedValue(ORDER)
    await updateOrderStatus('order_1', 'SHIPPED')
    expect(prisma.order.update).toHaveBeenCalledWith({ where: { id: 'order_1' }, data: { status: 'SHIPPED' } })
    expect(revalidatePath).toHaveBeenCalledWith('/store/orders')
  })
})
