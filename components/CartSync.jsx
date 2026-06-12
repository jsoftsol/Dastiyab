'use client'
import { useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useDispatch, useSelector } from 'react-redux'
import { setCart } from '@/lib/features/cart/cartSlice'
import { syncCart } from '@/lib/syncCart'

export default function CartSync() {
  const { data: session, status } = useSession()
  const dispatch = useDispatch()
  const localCart = useSelector(state => state.cart.cartItems)
  const localCartRef = useRef(localCart)
  const synced = useRef(false)

  useEffect(() => {
    localCartRef.current = localCart
  }, [localCart])

  useEffect(() => {
    if (status !== 'authenticated' || synced.current) return
    synced.current = true

    async function merge() {
      const res = await fetch('/api/customer/cart')
      if (!res.ok) return
      const { cart: dbCart } = await res.json()

      const merged = { ...dbCart }
      const local = localCartRef.current
      for (const [productId, qty] of Object.entries(local)) {
        merged[productId] = Math.max(merged[productId] ?? 0, qty)
      }

      dispatch(setCart(merged))
      syncCart(merged)
    }

    merge()
  }, [status, dispatch])

  return null
}
