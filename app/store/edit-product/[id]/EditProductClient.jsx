'use client'
import { assets } from '@/assets/assets'
import Image from 'next/image'
import { useState, useTransition } from 'react'
import { toast } from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { updateProduct } from '@/app/store/actions'

const CATEGORIES = [
  'Electronics', 'Clothing', 'Home & Kitchen', 'Beauty & Health',
  'Toys & Games', 'Sports & Outdoors', 'Books & Media', 'Food & Drink',
  'Hobbies & Crafts', 'Others',
]

export default function EditProductClient({ product }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [form, setForm] = useState({
    name: product.name,
    description: product.description,
    mrp: String(product.mrp),
    price: String(product.price),
    category: product.category,
  })

  const [slots, setSlots] = useState(
    [0, 1, 2, 3].map(i => ({ existingUrl: product.images[i] || null, file: null }))
  )

  const onChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleFileChange = (index, file) => {
    setSlots(prev => prev.map((s, i) => i === index ? { ...s, file } : s))
  }

  const getPreview = slot => {
    if (slot.file) return URL.createObjectURL(slot.file)
    if (slot.existingUrl) return slot.existingUrl
    return assets.upload_area
  }

  const handleSubmit = async e => {
    e.preventDefault()
    startTransition(async () => {
      const imageUrls = []
      for (const slot of slots) {
        if (slot.file) {
          const fd = new FormData()
          fd.append('file', slot.file)
          const res = await fetch('/api/upload', { method: 'POST', body: fd })
          if (!res.ok) {
            toast.error('Image upload failed')
            return
          }
          const data = await res.json()
          if (data.error) {
            toast.error('Image upload failed')
            return
          }
          imageUrls.push(data.url)
        } else if (slot.existingUrl) {
          imageUrls.push(slot.existingUrl)
        }
      }

      if (imageUrls.length === 0) {
        toast.error('Product must have at least one image')
        return
      }

      const result = await updateProduct(product.id, { ...form, images: imageUrls })
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success('Product updated!')
      router.push('/store/manage-product')
    })
  }

  return (
    <form onSubmit={handleSubmit} className="text-slate-500 mb-28">
      <h1 className="text-2xl">Edit <span className="text-slate-800 font-medium">Product</span></h1>
      <p className="mt-7">Product Images</p>

      <div className="flex gap-3 mt-4">
        {slots.map((slot, index) => (
          <label key={index} htmlFor={`edit-image-${index}`}>
            <Image
              width={300}
              height={300}
              className="h-15 w-auto border border-slate-200 rounded cursor-pointer"
              src={getPreview(slot)}
              alt=""
              unoptimized
            />
            <input
              type="file"
              accept="image/*"
              id={`edit-image-${index}`}
              onChange={e => handleFileChange(index, e.target.files[0])}
              hidden
            />
          </label>
        ))}
      </div>

      <label className="flex flex-col gap-2 my-6">
        Name
        <input
          type="text"
          name="name"
          onChange={onChange}
          value={form.name}
          placeholder="Enter product name"
          className="w-full max-w-sm p-2 px-4 outline-none border border-slate-200 rounded"
          required
        />
      </label>

      <label className="flex flex-col gap-2 my-6">
        Description
        <textarea
          name="description"
          onChange={onChange}
          value={form.description}
          placeholder="Enter product description"
          rows={5}
          className="w-full max-w-sm p-2 px-4 outline-none border border-slate-200 rounded resize-none"
          required
        />
      </label>

      <div className="flex gap-5">
        <label className="flex flex-col gap-2">
          Actual Price ($)
          <input
            type="number"
            name="mrp"
            onChange={onChange}
            value={form.mrp}
            placeholder="0"
            className="w-full max-w-45 p-2 px-4 outline-none border border-slate-200 rounded"
            required
          />
        </label>
        <label className="flex flex-col gap-2">
          Offer Price ($)
          <input
            type="number"
            name="price"
            onChange={onChange}
            value={form.price}
            placeholder="0"
            className="w-full max-w-45 p-2 px-4 outline-none border border-slate-200 rounded"
            required
          />
        </label>
      </div>

      <select
        onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
        value={form.category}
        className="w-full max-w-sm p-2 px-4 my-6 outline-none border border-slate-200 rounded"
        required
      >
        <option value="">Select a category</option>
        {CATEGORIES.map(cat => (
          <option key={cat} value={cat}>{cat}</option>
        ))}
      </select>

      <div className="flex gap-3 mt-7">
        <button
          type="submit"
          disabled={isPending}
          className="bg-slate-800 text-white px-6 py-2 hover:bg-slate-900 rounded transition disabled:opacity-50"
        >
          {isPending ? 'Saving...' : 'Save Changes'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/store/manage-product')}
          className="bg-slate-100 px-6 py-2 hover:bg-slate-200 rounded transition"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
