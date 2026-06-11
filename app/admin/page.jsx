import prisma from '@/lib/prisma'
import OrdersAreaChart from '@/components/OrdersAreaChart'
import { CircleDollarSignIcon, ShoppingBasketIcon, StoreIcon, TagsIcon } from 'lucide-react'

export default async function AdminDashboard() {
    const currency = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || '$'

    const [productCount, revenueAgg, orderCount, storeCount, allOrders] = await Promise.all([
        prisma.product.count(),
        prisma.order.aggregate({ _sum: { total: true } }),
        prisma.order.count(),
        prisma.store.count({ where: { status: 'approved' } }),
        prisma.order.findMany({ select: { createdAt: true, total: true } }),
    ])

    const revenue = revenueAgg._sum.total ?? 0

    const dashboardCardsData = [
        { title: 'Total Products', value: productCount, icon: ShoppingBasketIcon },
        { title: 'Total Revenue', value: currency + revenue.toFixed(2), icon: CircleDollarSignIcon },
        { title: 'Total Orders', value: orderCount, icon: TagsIcon },
        { title: 'Total Stores', value: storeCount, icon: StoreIcon },
    ]

    const serializedOrders = allOrders.map(o => ({
        ...o,
        createdAt: o.createdAt.toISOString(),
    }))

    return (
        <div className="text-slate-500">
            <h1 className="text-2xl">Admin <span className="text-slate-800 font-medium">Dashboard</span></h1>

            <div className="flex flex-wrap gap-5 my-10 mt-4">
                {dashboardCardsData.map((card, index) => (
                    <div key={index} className="flex items-center gap-10 border border-slate-200 p-3 px-6 rounded-lg">
                        <div className="flex flex-col gap-3 text-xs">
                            <p>{card.title}</p>
                            <b className="text-2xl font-medium text-slate-700">{card.value}</b>
                        </div>
                        <card.icon size={50} className="w-11 h-11 p-2.5 text-slate-400 bg-slate-100 rounded-full" />
                    </div>
                ))}
            </div>

            <OrdersAreaChart allOrders={serializedOrders} />
        </div>
    )
}