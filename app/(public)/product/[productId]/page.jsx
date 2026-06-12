'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import ProductDetails from '@/components/ProductDetails'
import ProductDescription from '@/components/ProductDescription'

export default function ProductPage() {
  const { productId } = useParams()
  const [product, setProduct] = useState(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/public/products/${productId}`)
      if (!res.ok) { setNotFound(true); return }
      const data = await res.json()
      setProduct(data.product)
    }
    load()
    scrollTo(0, 0)
  }, [productId])

  if (notFound) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-slate-400 text-xl">Product not found.</p>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-slate-400">Loading...</p>
      </div>
    )
  }

  return (
    <div className="mx-6">
      <div className="max-w-7xl mx-auto">

        {/* Breadcrumbs */}
        <div className="text-gray-600 text-sm mt-8 mb-5">
          Home / Products / {product.category}
        </div>

        {/* Product Details */}
        <ProductDetails product={product} />

        {/* Description & Reviews */}
        <ProductDescription product={product} />
      </div>
    </div>
  )
}
