'use client'
import { useEffect, useState, useCallback } from 'react'
import OrderItem from '@/components/OrderItem'

export default function OrdersPage() {
  const [orders, setOrders] = useState([])
  const [ratings, setRatings] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchOrders = useCallback(async () => {
    const res = await fetch('/api/customer/orders')
    if (res.ok) {
      const data = await res.json()
      setOrders(data.orders ?? [])
      setRatings(data.ratings ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><p className="text-slate-400">Loading orders...</p></div>
  }

  if (orders.length === 0) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-slate-400 text-xl">No orders yet.</p>
      </div>
    )
  }

  return (
    <div className="px-6 py-10 max-w-4xl mx-auto">
      <h1 className="text-2xl font-medium mb-8">My Orders</h1>
      <div className="space-y-6">
        {orders.map(order => (
          <OrderItem
            key={order.id}
            order={order}
            ratings={ratings}
            onRatingSubmitted={fetchOrders}
          />
        ))}
      </div>
    </div>
  )
}
