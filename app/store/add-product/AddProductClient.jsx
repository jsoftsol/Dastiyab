'use client'
import { assets } from '@/assets/assets'
import Image from 'next/image'
import { useState, useTransition } from 'react'
import { toast } from 'react-hot-toast'
import { createProduct } from '@/app/store/actions'

const CATEGORIES = [
  'Electronics', 'Clothing', 'Home & Kitchen', 'Beauty & Health',
  'Toys & Games', 'Sports & Outdoors', 'Books & Media', 'Food & Drink',
  'Hobbies & Crafts', 'Others',
]

const DEFAULT_FORM = { name: '', description: '', mrp: '', price: '', category: '' }

export default function AddProductClient() {
  const [images, setImages] = useState({ 1: null, 2: null, 3: null, 4: null })
  const [form, setForm] = useState(DEFAULT_FORM)
  const [isPending, startTransition] = useTransition()

  const onChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async e => {
    e.preventDefault()
    startTransition(async () => {
      const files = Object.values(images).filter(Boolean)
      if (files.length === 0) {
        toast.error('Add at least one image')
        return
      }

      const uploadedUrls = []
      for (const file of files) {
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch('/api/upload', { method: 'POST', body: fd })
        const data = await res.json()
        if (data.error) {
          toast.error('Image upload failed')
          return
        }
        uploadedUrls.push(data.url)
      }

      const result = await createProduct({ ...form, images: uploadedUrls })
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success('Product added!')
      setImages({ 1: null, 2: null, 3: null, 4: null })
      setForm(DEFAULT_FORM)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="text-slate-500 mb-28">
      <h1 className="text-2xl">Add New <span className="text-slate-800 font-medium">Products</span></h1>
      <p className="mt-7">Product Images</p>

      <div className="flex gap-3 mt-4">
        {Object.keys(images).map(key => (
          <label key={key} htmlFor={`images${key}`}>
            <Image
              width={300}
              height={300}
              className="h-15 w-auto border border-slate-200 rounded cursor-pointer"
              src={images[key] ? URL.createObjectURL(images[key]) : assets.upload_area}
              alt=""
            />
            <input
              type="file"
              accept="image/*"
              id={`images${key}`}
              onChange={e => setImages(prev => ({ ...prev, [key]: e.target.files[0] }))}
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

      <button
        type="submit"
        disabled={isPending}
        className="bg-slate-800 text-white px-6 mt-7 py-2 hover:bg-slate-900 rounded transition disabled:opacity-50"
      >
        {isPending ? 'Adding...' : 'Add Product'}
      </button>
    </form>
  )
}
