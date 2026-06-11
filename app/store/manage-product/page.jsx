import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import ManageProductClient from './ManageProductClient'

export default async function StoreManageProducts() {
  const { userId } = await getAuthUser()
  const store = await prisma.store.findUnique({ where: { userId } })

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
