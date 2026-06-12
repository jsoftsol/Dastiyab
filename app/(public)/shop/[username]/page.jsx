'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import ProductCard from '@/components/ProductCard'
import Loading from '@/components/Loading'
import Image from 'next/image'
import { MailIcon, MapPinIcon } from 'lucide-react'

export default function StoreShopPage() {
  const { username } = useParams()
  const [store, setStore] = useState(null)
  const [products, setProducts] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const sentinelRef = useRef(null)

  // Load first page + store info
  useEffect(() => {
    async function init() {
      setLoading(true)
      const res = await fetch(`/api/public/stores/${username}`)
      if (!res.ok) {
        setNotFound(true)
        setLoading(false)
        return
      }
      const data = await res.json()
      setStore(data.store)
      setProducts(data.products ?? [])
      setTotalPages(data.totalPages ?? 1)
      setPage(1)
      setLoading(false)
    }
    init()
  }, [username])

  const fetchNextPage = useCallback(async () => {
    if (loading || page >= totalPages || !store) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: page + 1, limit: 12, storeId: store.id })
      const res = await fetch(`/api/public/products?${params}`)
      const data = await res.json()
      setProducts(prev => [...prev, ...(data.products ?? [])])
      setPage(p => p + 1)
    } finally {
      setLoading(false)
    }
  }, [loading, page, totalPages, store])

  // IntersectionObserver for auto-load
  useEffect(() => {
    if (!sentinelRef.current) return
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !loading && page < totalPages) {
        fetchNextPage()
      }
    }, { threshold: 0.1 })
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [loading, page, totalPages, fetchNextPage])

  if (loading && !store) return <Loading />

  if (notFound) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-slate-400 text-xl">Store not found or unavailable.</p>
      </div>
    )
  }

  return (
    <div className="min-h-[70vh] mx-6">

      {/* Store Info Banner */}
      {store && (
        <div className="max-w-7xl mx-auto bg-slate-50 rounded-xl p-6 md:p-10 mt-6 flex flex-col md:flex-row items-center gap-6 shadow-xs">
          {store.logo && (
            <Image
              src={store.logo}
              alt={store.name}
              className="size-32 sm:size-38 object-cover border-2 border-slate-100 rounded-md"
              width={200}
              height={200}
            />
          )}
          <div className="text-center md:text-left">
            <h1 className="text-3xl font-semibold text-slate-800">{store.name}</h1>
            <p className="text-sm text-slate-600 mt-2 max-w-lg">{store.description}</p>
            <div className="space-y-2 text-sm text-slate-500 mt-4">
              {store.address && (
                <div className="flex items-center">
                  <MapPinIcon className="w-4 h-4 text-gray-500 mr-2" />
                  <span>{store.address}</span>
                </div>
              )}
              {store.email && (
                <div className="flex items-center">
                  <MailIcon className="w-4 h-4 text-gray-500 mr-2" />
                  <span>{store.email}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Products */}
      <div className="max-w-7xl mx-auto mb-40">
        <h1 className="text-2xl mt-12">Shop <span className="text-slate-800 font-medium">Products</span></h1>
        <div className="mt-5 grid grid-cols-2 sm:flex flex-wrap gap-6 xl:gap-12 mx-auto">
          {products.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        <div ref={sentinelRef} className="h-4 mt-4" />

        {page < totalPages && (
          <div className="flex justify-center mt-6">
            <button
              onClick={fetchNextPage}
              disabled={loading}
              className="px-8 py-2 bg-slate-800 text-white rounded hover:bg-slate-900 disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Load More'}
            </button>
          </div>
        )}

        {!loading && products.length === 0 && store && (
          <p className="text-center text-slate-400 mt-10">This store has no products yet.</p>
        )}
      </div>
    </div>
  )
}
