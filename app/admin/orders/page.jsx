import prisma from '@/lib/prisma'
import OrdersClient from './OrdersClient'

export const dynamic = 'force-dynamic'

export default async function AdminOrders() {
    const orders = await prisma.order.findMany({
        include: {
            user: { select: { name: true, email: true } },
            store: { select: { name: true } },
            orderItems: { include: { product: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
    })

    const serialized = orders.map(o => ({
        ...o,
        createdAt: o.createdAt.toISOString(),
        updatedAt: o.updatedAt.toISOString(),
    }))

    return (
        <div className="text-slate-500 mb-28">
            <h1 className="text-2xl">All <span className="text-slate-800 font-medium">Orders</span></h1>
            <OrdersClient orders={serialized} />
        </div>
    )
}
