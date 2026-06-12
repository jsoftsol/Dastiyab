import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { notFound } from 'next/navigation'
import EditProductClient from './EditProductClient'

export const dynamic = 'force-dynamic'

export default async function EditProductPage({ params }) {
  const { id } = await params
  const { userId } = await getAuthUser()
  const store = await prisma.store.findUnique({ where: { userId } })
  if (!store) notFound()

  const product = await prisma.product.findUnique({ where: { id } })
  if (!product || product.storeId !== store.id) notFound()

  const serialized = {
    ...product,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  }

  return <EditProductClient product={serialized} />
}
