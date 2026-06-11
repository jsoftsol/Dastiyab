'use client'
import { useTransition } from 'react'
import { updateOrderStatus } from '@/app/admin/actions'
import toast from 'react-hot-toast'

const ORDER_STATUSES = ['ORDER_PLACED', 'PROCESSING', 'SHIPPED', 'DELIVERED']

export default function OrdersClient({ orders }) {
    const [isPending, startTransition] = useTransition()

    const handleStatusChange = (orderId, status) => {
        startTransition(async () => {
            const result = await updateOrderStatus(orderId, status)
            if (result?.error) toast.error(result.error)
        })
    }

    if (!orders.length) {
        return (
            <div className="flex items-center justify-center h-80">
                <h1 className="text-3xl text-slate-400 font-medium">No Orders Yet</h1>
            </div>
        )
    }

    return (
        <div className="overflow-x-auto mt-4 rounded-lg border border-slate-200 max-w-6xl">
            <table className="min-w-full bg-white text-sm">
                <thead className="bg-slate-50">
                    <tr>
                        {['Order ID', 'Customer', 'Store', 'Items', 'Total', 'Payment', 'Status', 'Date'].map(h => (
                            <th key={h} className="py-3 px-4 text-left font-semibold text-slate-600">{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                    {orders.map((order) => (
                        <tr key={order.id} className="hover:bg-slate-50">
                            <td className="py-3 px-4 font-mono text-xs text-slate-600">{order.id.slice(0, 8)}…</td>
                            <td className="py-3 px-4 text-slate-800">{order.user.name || order.user.email}</td>
                            <td className="py-3 px-4 text-slate-800">{order.store.name}</td>
                            <td className="py-3 px-4 text-slate-800">{order.orderItems.length}</td>
                            <td className="py-3 px-4 text-slate-800">${order.total.toFixed(2)}</td>
                            <td className="py-3 px-4 text-slate-800">{order.paymentMethod}</td>
                            <td className="py-3 px-4">
                                <select
                                    value={order.status}
                                    disabled={isPending}
                                    onChange={(e) => handleStatusChange(order.id, e.target.value)}
                                    className="border border-slate-200 rounded p-1 text-xs text-slate-700 disabled:opacity-50"
                                >
                                    {ORDER_STATUSES.map(s => (
                                        <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                                    ))}
                                </select>
                            </td>
                            <td className="py-3 px-4 text-slate-500 text-xs">
                                {new Date(order.createdAt).toLocaleDateString()}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
