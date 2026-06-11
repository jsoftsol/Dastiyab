'use client'
import Image from 'next/image'
import Link from 'next/link'
import { useTransition } from 'react'
import { toast } from 'react-hot-toast'
import { toggleInStock, deleteProduct } from '@/app/store/actions'

export default function ManageProductClient({ products }) {
  const currency = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || '$'
  const [isPending, startTransition] = useTransition()

  const handleToggle = (productId, currentInStock) => {
    startTransition(async () => {
      const result = await toggleInStock(productId, !currentInStock)
      if (result?.error) toast.error(result.error)
    })
  }

  const handleDelete = (productId) => {
    if (!window.confirm('Delete this product? This cannot be undone.')) return
    startTransition(async () => {
      const result = await deleteProduct(productId)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success('Product deleted')
      }
    })
  }

  return (
    <>
      <h1 className="text-2xl text-slate-500 mb-5">
        Manage <span className="text-slate-800 font-medium">Products</span>
      </h1>
      {products.length === 0 ? (
        <p className="text-slate-400 text-sm">No products yet. <Link href="/store/add-product" className="text-green-600 underline">Add one.</Link></p>
      ) : (
        <table className="w-full max-w-4xl text-left ring ring-slate-200 rounded overflow-hidden text-sm">
          <thead className="bg-slate-50 text-gray-700 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3 hidden md:table-cell">Description</th>
              <th className="px-4 py-3 hidden md:table-cell">MRP</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">In Stock</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="text-slate-700">
            {products.map(product => (
              <tr key={product.id} className="border-t border-gray-200 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex gap-2 items-center">
                    <Image
                      width={40}
                      height={40}
                      className="p-1 shadow rounded"
                      src={product.images[0] || '/placeholder.png'}
                      alt=""
                    />
                    {product.name}
                  </div>
                </td>
                <td className="px-4 py-3 max-w-md text-slate-600 hidden md:table-cell truncate">
                  {product.description}
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  {currency} {product.mrp.toLocaleString()}
                </td>
                <td className="px-4 py-3">{currency} {product.price.toLocaleString()}</td>
                <td className="px-4 py-3">
                  <label className="relative inline-flex items-center cursor-pointer text-gray-900 gap-3">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={product.inStock}
                      disabled={isPending}
                      onChange={() => handleToggle(product.id, product.inStock)}
                    />
                    <div className="w-9 h-5 bg-slate-300 rounded-full peer peer-checked:bg-green-600 transition-colors duration-200"></div>
                    <span className="dot absolute left-1 top-1 w-3 h-3 bg-white rounded-full transition-transform duration-200 ease-in-out peer-checked:translate-x-4"></span>
                  </label>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/store/edit-product/${product.id}`}
                      className="text-xs bg-slate-100 hover:bg-slate-200 px-3 py-1 rounded transition"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDelete(product.id)}
                      disabled={isPending}
                      className="text-xs bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1 rounded transition disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
