'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'

export default function AddressModal({ onClose, onAddressAdded }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', street: '', city: '', state: '', zip: '', country: '' })
  const [saving, setSaving] = useState(false)

  const onChange = e => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/customer/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to save address'); return }
      toast.success('Address saved')
      onAddressAdded()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold mb-4">Add Address</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          {['name', 'email', 'phone', 'street', 'city', 'state', 'zip', 'country'].map(field => (
            <input
              key={field}
              name={field}
              value={form[field]}
              onChange={onChange}
              placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
              required
              className="w-full border rounded p-2 text-sm"
            />
          ))}
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-500">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-slate-800 text-white text-sm rounded disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Address'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
