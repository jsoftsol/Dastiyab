'use client'
import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { clearCart } from '@/lib/features/cart/cartSlice'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import AddressModal from '@/components/AddressModal'

export default function OrderSummary({ products }) {
  const { cartItems } = useSelector(state => state.cart)
  const dispatch = useDispatch()
  const router = useRouter()

  const [addresses, setAddresses] = useState([])
  const [selectedAddressId, setSelectedAddressId] = useState('')
  const [couponCode, setCouponCode] = useState('')
  const [discount, setDiscount] = useState(0)
  const [couponError, setCouponError] = useState('')
  const [showAddressModal, setShowAddressModal] = useState(false)
  const [placing, setPlacing] = useState(false)

  const subtotal = products.reduce((sum, p) => sum + p.price * (cartItems[p.id] ?? 0), 0)
  const total = Math.max(0, subtotal - discount)

  const fetchAddresses = async () => {
    const res = await fetch('/api/customer/addresses')
    if (res.ok) {
      const data = await res.json()
      setAddresses(data.addresses ?? [])
    }
  }

  useEffect(() => {
    fetchAddresses()
  }, [])

  const applyCoupon = async () => {
    setCouponError('')
    const res = await fetch('/api/public/coupons/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: couponCode }),
    })
    const data = await res.json()
    if (!res.ok) {
      setCouponError(data.error ?? 'Invalid coupon')
      setDiscount(0)
    } else {
      setDiscount(data.discount)
      setCouponError('')
    }
  }

  const placeOrder = async () => {
    if (!selectedAddressId) { toast.error('Please select a delivery address'); return }

    const items = Object.entries(cartItems).map(([productId, quantity]) => ({ productId, quantity }))
    if (items.length === 0) { toast.error('Cart is empty'); return }

    setPlacing(true)
    try {
      const res = await fetch('/api/customer/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addressId: selectedAddressId,
          couponCode: discount > 0 ? couponCode : undefined,
          items,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to place order'); return }

      dispatch(clearCart())
      toast.success('Order placed!')
      router.push('/orders')
    } finally {
      setPlacing(false)
    }
  }

  return (
    <div className="w-full lg:w-80 border rounded-lg p-6 h-fit sticky top-4">
      <h2 className="text-lg font-semibold mb-4">Order Summary</h2>

      {/* Address selector */}
      <div className="mb-4">
        <label className="text-sm text-slate-500 block mb-1">Delivery Address</label>
        <select
          value={selectedAddressId}
          onChange={e => setSelectedAddressId(e.target.value)}
          className="w-full border rounded p-2 text-sm"
        >
          <option value="">Select address</option>
          {addresses.map(a => (
            <option key={a.id} value={a.id}>{a.street}, {a.city}</option>
          ))}
        </select>
        <button
          onClick={() => setShowAddressModal(true)}
          className="text-xs text-slate-500 underline mt-1"
        >
          + Add new address
        </button>
      </div>

      {/* Coupon */}
      <div className="mb-4">
        <label className="text-sm text-slate-500 block mb-1">Coupon Code</label>
        <div className="flex gap-2">
          <input
            value={couponCode}
            onChange={e => setCouponCode(e.target.value)}
            placeholder="Enter code"
            className="flex-1 border rounded p-2 text-sm"
          />
          <button onClick={applyCoupon} className="px-3 py-2 bg-slate-800 text-white text-sm rounded">Apply</button>
        </div>
        {couponError && <p className="text-red-500 text-xs mt-1">{couponError}</p>}
        {discount > 0 && <p className="text-green-600 text-xs mt-1">Discount: Rs {discount.toLocaleString()}</p>}
      </div>

      {/* Totals */}
      <div className="border-t pt-4 space-y-2 text-sm">
        <div className="flex justify-between"><span>Subtotal</span><span>Rs {subtotal.toLocaleString()}</span></div>
        {discount > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-Rs {discount.toLocaleString()}</span></div>}
        <div className="flex justify-between font-semibold text-base"><span>Total</span><span>Rs {total.toLocaleString()}</span></div>
      </div>

      <button
        onClick={placeOrder}
        disabled={placing}
        className="w-full mt-6 py-3 bg-slate-800 text-white rounded font-medium hover:bg-slate-900 disabled:opacity-50"
      >
        {placing ? 'Placing order...' : 'Place Order (COD)'}
      </button>

      {showAddressModal && (
        <AddressModal
          onClose={() => setShowAddressModal(false)}
          onAddressAdded={() => { fetchAddresses(); setShowAddressModal(false) }}
        />
      )}
    </div>
  )
}
