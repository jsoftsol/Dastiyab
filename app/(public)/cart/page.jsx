'use client'
import { useEffect, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { deleteItemFromCart } from '@/lib/features/cart/cartSlice'
import { syncCart } from '@/lib/syncCart'
import Link from 'next/link'
import Image from 'next/image'
import OrderSummary from '@/components/OrderSummary'

export default function CartPage() {
  const { cartItems } = useSelector(state => state.cart)
  const dispatch = useDispatch()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  const productIds = Object.keys(cartItems)

  useEffect(() => {
    if (productIds.length === 0) {
      setProducts([])
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all(productIds.map(id => fetch(`/api/public/products/${id}`).then(r => r.ok ? r.json() : null)))
      .then(results => {
        setProducts(results.filter(Boolean).map(r => r.product))
      })
      .finally(() => setLoading(false))
  }, [JSON.stringify(productIds)])

  const handleDelete = (productId) => {
    dispatch(deleteItemFromCart({ productId }))
    const updatedCart = { ...cartItems }
    delete updatedCart[productId]
    syncCart(updatedCart)
  }

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><p className="text-slate-400">Loading cart...</p></div>
  }

  if (productIds.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <p className="text-slate-400 text-xl">Your cart is empty.</p>
        <Link href="/shop" className="text-slate-800 underline">Continue shopping</Link>
      </div>
    )
  }

  return (
    <div className="px-6 py-10 max-w-7xl mx-auto flex flex-col lg:flex-row gap-10">
      {/* Cart items */}
      <div className="flex-1">
        <h1 className="text-2xl font-medium mb-6">Shopping Cart</h1>
        {products.map(product => (
          <div key={product.id} className="flex gap-4 border-b py-4 items-center">
            <Image src={product.images?.[0] ?? ''} width={80} height={80} alt={product.name} className="rounded object-cover" />
            <div className="flex-1">
              <p className="font-medium">{product.name}</p>
              <p className="text-slate-500 text-sm">Qty: {cartItems[product.id]}</p>
              <p className="text-slate-800">Rs {(product.price * cartItems[product.id]).toLocaleString()}</p>
            </div>
            <button onClick={() => handleDelete(product.id)} className="text-red-500 hover:underline text-sm">Remove</button>
          </div>
        ))}
      </div>

      {/* Order summary sidebar */}
      <OrderSummary products={products} />
    </div>
  )
}
