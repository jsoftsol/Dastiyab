import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { notFound } from 'next/navigation'
import OrdersClient from './OrdersClient'

export const dynamic = 'force-dynamic'

export default async function StoreOrders() {
  const { userId } = await getAuthUser()
  const store = await prisma.store.findUnique({ where: { userId } })
  if (!store) notFound()

  const orders = await prisma.order.findMany({
    where: { storeId: store.id },
    include: {
      user: true,
      orderItems: { include: { product: true } },
      address: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  const serialized = orders.map(o => ({
    ...o,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    user: o.user
      ? { ...o.user, emailVerified: o.user.emailVerified?.toISOString() ?? null }
      : null,
    address: o.address
      ? { ...o.address, createdAt: o.address.createdAt.toISOString() }
      : null,
    orderItems: o.orderItems.map(item => ({
      ...item,
      product: item.product
        ? { ...item.product, createdAt: item.product.createdAt.toISOString(), updatedAt: item.product.updatedAt.toISOString() }
        : null,
    })),
  }))

  return <OrdersClient orders={serialized} />
}
