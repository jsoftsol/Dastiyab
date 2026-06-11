import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { notFound } from 'next/navigation'
import ManageProductClient from './ManageProductClient'

export default async function StoreManageProducts() {
  const { userId } = await getAuthUser()
  const store = await prisma.store.findUnique({ where: { userId } })
  if (!store) notFound()

  const products = await prisma.product.findMany({
    where: { storeId: store.id },
    orderBy: { createdAt: 'desc' },
  })

  const serialized = products.map(p => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }))

  return <ManageProductClient products={serialized} />
}
