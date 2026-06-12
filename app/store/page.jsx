import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { notFound } from 'next/navigation'
import { CircleDollarSignIcon, ShoppingBasketIcon, StarIcon, TagsIcon } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function Dashboard() {
  const currency = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || '$'
  const { userId } = await getAuthUser()
  const store = await prisma.store.findUnique({ where: { userId } })
  if (!store) notFound()

  const [productCount, earningsAgg, orderCount, ratingCount, recentRatings] = await Promise.all([
    prisma.product.count({ where: { storeId: store.id } }),
    prisma.order.aggregate({ where: { storeId: store.id }, _sum: { total: true } }),
    prisma.order.count({ where: { storeId: store.id } }),
    prisma.rating.count({ where: { product: { storeId: store.id } } }),
    prisma.rating.findMany({
      where: { product: { storeId: store.id } },
      include: { product: true, user: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ])

  const earnings = earningsAgg._sum.total ?? 0

  const serializedRatings = recentRatings.map(r => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    product: r.product
      ? { ...r.product, createdAt: r.product.createdAt.toISOString(), updatedAt: r.product.updatedAt.toISOString() }
      : null,
    user: r.user
      ? { ...r.user, emailVerified: r.user.emailVerified?.toISOString() ?? null }
      : null,
  }))

  const statCards = [
    { title: 'Total Products', value: productCount, icon: ShoppingBasketIcon },
    { title: 'Total Earnings', value: currency + earnings.toLocaleString(), icon: CircleDollarSignIcon },
    { title: 'Total Orders', value: orderCount, icon: TagsIcon },
    { title: 'Total Ratings', value: ratingCount, icon: StarIcon },
  ]

  return (
    <div className="text-slate-500 mb-28">
      <h1 className="text-2xl">Seller <span className="text-slate-800 font-medium">Dashboard</span></h1>

      <div className="flex flex-wrap gap-5 my-10 mt-4">
        {statCards.map((card, index) => (
          <div key={card.title} className="flex items-center gap-11 border border-slate-200 p-3 px-6 rounded-lg">
            <div className="flex flex-col gap-3 text-xs">
              <p>{card.title}</p>
              <b className="text-2xl font-medium text-slate-700">{card.value}</b>
            </div>
            <card.icon size={50} className="w-11 h-11 p-2.5 text-slate-400 bg-slate-100 rounded-full" />
          </div>
        ))}
      </div>

      <h2>Total Reviews</h2>

      <div className="mt-5">
        {serializedRatings.map((review, index) => (
          <div
            key={review.id}
            className="flex max-sm:flex-col gap-5 sm:items-center justify-between py-6 border-b border-slate-200 text-sm text-slate-600 max-w-4xl"
          >
            <div>
              <div className="flex gap-3">
                <Image
                  src={review.user?.image || '/placeholder.png'}
                  alt=""
                  className="w-10 aspect-square rounded-full"
                  width={100}
                  height={100}
                />
                <div>
                  <p className="font-medium">{review.user?.name}</p>
                  <p className="font-light text-slate-500">{new Date(review.createdAt).toDateString()}</p>
                </div>
              </div>
              <p className="mt-3 text-slate-500 max-w-xs leading-6">{review.review}</p>
            </div>
            <div className="flex flex-col justify-between gap-6 sm:items-end">
              <div className="flex flex-col sm:items-end">
                <p className="text-slate-400">{review.product?.category}</p>
                <p className="font-medium">{review.product?.name}</p>
                <div className="flex items-center">
                  {Array(5).fill('').map((_, i) => (
                    <StarIcon
                      key={i}
                      size={17}
                      className="text-transparent mt-0.5"
                      fill={review.rating >= i + 1 ? '#00C950' : '#D1D5DB'}
                    />
                  ))}
                </div>
              </div>
              <Link
                href={`/product/${review.product?.id}`}
                className="bg-slate-100 px-5 py-2 hover:bg-slate-200 rounded transition-all"
              >
                View Product
              </Link>
            </div>
          </div>
        ))}
        {serializedRatings.length === 0 && (
          <p className="text-slate-400 text-sm">No reviews yet.</p>
        )}
      </div>
    </div>
  )
}