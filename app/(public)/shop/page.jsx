'use client'
import { Suspense, useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { MoveLeftIcon } from 'lucide-react'
import ProductCard from '@/components/ProductCard'

function ShopContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const search = searchParams.get('search') || ''
  const category = searchParams.get('category') || ''

  const [products, setProducts] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const sentinelRef = useRef(null)

  const fetchPage = useCallback(async (pageNum) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: pageNum, limit: 12 })
      if (search) params.set('search', search)
      if (category) params.set('category', category)
      const res = await fetch(`/api/public/products?${params}`)
      const data = await res.json()
      setProducts(prev =>
        pageNum === 1
          ? (data.products ?? [])
          : [...prev, ...(data.products ?? [])]
      )
      setTotalPages(data.totalPages ?? 1)
      setPage(pageNum)
    } finally {
      setLoading(false)
    }
  }, [search, category])

  // Reset and reload when filters change
  useEffect(() => {
    fetchPage(1)
  }, [fetchPage])

  // IntersectionObserver for auto-load
  useEffect(() => {
    if (!sentinelRef.current) return
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !loading && page < totalPages) {
        fetchPage(page + 1)
      }
    }, { threshold: 0.1 })
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [loading, page, totalPages, fetchPage])

  return (
    <div className="min-h-[70vh] mx-6">
      <div className="max-w-7xl mx-auto">
        <h1
          onClick={() => router.push('/shop')}
          className="text-2xl text-slate-500 my-6 flex items-center gap-2 cursor-pointer"
        >
          {search && <MoveLeftIcon size={20} />}
          All <span className="text-slate-700 font-medium">Products</span>
        </h1>

        <div className="grid grid-cols-2 sm:flex flex-wrap gap-6 xl:gap-12 mx-auto mb-32">
          {products.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        {/* Sentinel div — IntersectionObserver target */}
        <div ref={sentinelRef} className="h-4 mt-4" />

        {/* Load More fallback */}
        {page < totalPages && (
          <div className="flex justify-center mt-6">
            <button
              onClick={() => fetchPage(page + 1)}
              disabled={loading}
              className="px-8 py-2 bg-slate-800 text-white rounded hover:bg-slate-900 disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Load More'}
            </button>
          </div>
        )}

        {loading && products.length === 0 && (
          <p className="text-center text-slate-400 mt-10">Loading products...</p>
        )}

        {!loading && products.length === 0 && (
          <p className="text-center text-slate-400 mt-10">No products found.</p>
        )}
      </div>
    </div>
  )
}

export default function Shop() {
  return (
    <Suspense fallback={<div>Loading shop...</div>}>
      <ShopContent />
    </Suspense>
  )
}
