'use client'
import { useState, useTransition } from 'react'
import { createCoupon, deleteCoupon } from '@/app/admin/actions'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { DeleteIcon } from 'lucide-react'

const defaultCoupon = {
    code: '',
    description: '',
    discount: '',
    forNewUser: false,
    forMember: false,
    isPublic: false,
    expiresAt: format(new Date(), 'yyyy-MM-dd'),
}

export default function CouponsClient({ coupons }) {
    const [isPending, startTransition] = useTransition()
    const [newCoupon, setNewCoupon] = useState(defaultCoupon)

    const handleChange = (e) => {
        setNewCoupon({ ...newCoupon, [e.target.name]: e.target.value })
    }

    const handleCheckbox = (e) => {
        setNewCoupon({ ...newCoupon, [e.target.name]: e.target.checked })
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        startTransition(async () => {
            const result = await createCoupon(newCoupon)
            if (result?.error) {
                toast.error(result.error)
            } else {
                toast.success('Coupon added')
                setNewCoupon(defaultCoupon)
            }
        })
    }

    const handleDelete = (code) => {
        startTransition(async () => {
            const result = await deleteCoupon(code)
            if (result?.error) toast.error(result.error)
            else toast.success('Coupon deleted')
        })
    }

    return (
        <div className="text-slate-500 mb-40">
            {/* Add Coupon Form */}
            <form onSubmit={handleSubmit} className="max-w-sm text-sm">
                <h2 className="text-2xl">Add <span className="text-slate-800 font-medium">Coupons</span></h2>
                <div className="flex gap-2 max-sm:flex-col mt-2">
                    <input
                        type="text" placeholder="Coupon Code" required
                        className="w-full mt-2 p-2 border border-slate-200 outline-slate-400 rounded-md"
                        name="code" value={newCoupon.code} onChange={handleChange}
                    />
                    <input
                        type="number" placeholder="Coupon Discount (%)" min={1} max={100} required
                        className="w-full mt-2 p-2 border border-slate-200 outline-slate-400 rounded-md"
                        name="discount" value={newCoupon.discount} onChange={handleChange}
                    />
                </div>
                <input
                    type="text" placeholder="Coupon Description" required
                    className="w-full mt-2 p-2 border border-slate-200 outline-slate-400 rounded-md"
                    name="description" value={newCoupon.description} onChange={handleChange}
                />
                <label>
                    <p className="mt-3">Coupon Expiry Date</p>
                    <input
                        type="date"
                        className="w-full mt-1 p-2 border border-slate-200 outline-slate-400 rounded-md"
                        name="expiresAt" value={newCoupon.expiresAt} onChange={handleChange}
                    />
                </label>
                <div className="mt-5">
                    {[
                        { name: 'forNewUser', label: 'For New User' },
                        { name: 'forMember', label: 'For Member' },
                    ].map(({ name, label }) => (
                        <div key={name} className="flex gap-2 mt-3">
                            <label className="relative inline-flex items-center cursor-pointer text-gray-900 gap-3">
                                <input
                                    type="checkbox" className="sr-only peer"
                                    name={name} checked={newCoupon[name]} onChange={handleCheckbox}
                                />
                                <div className="w-11 h-6 bg-slate-300 rounded-full peer peer-checked:bg-green-600 transition-colors duration-200"></div>
                                <span className="dot absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 ease-in-out peer-checked:translate-x-5"></span>
                            </label>
                            <p>{label}</p>
                        </div>
                    ))}
                </div>
                <button
                    type="submit" disabled={isPending}
                    className="mt-4 p-2 px-10 rounded bg-slate-700 text-white active:scale-95 transition disabled:opacity-50"
                >
                    {isPending ? 'Adding...' : 'Add Coupon'}
                </button>
            </form>

            {/* Coupon List */}
            <div className="mt-14">
                <h2 className="text-2xl">List <span className="text-slate-800 font-medium">Coupons</span></h2>
                <div className="overflow-x-auto mt-4 rounded-lg border border-slate-200 max-w-4xl">
                    <table className="min-w-full bg-white text-sm">
                        <thead className="bg-slate-50">
                            <tr>
                                {['Code', 'Description', 'Discount', 'Expires At', 'New User', 'For Member', 'Action'].map(h => (
                                    <th key={h} className="py-3 px-4 text-left font-semibold text-slate-600">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {coupons.map((coupon) => (
                                <tr key={coupon.code} className="hover:bg-slate-50">
                                    <td className="py-3 px-4 font-medium text-slate-800">{coupon.code}</td>
                                    <td className="py-3 px-4 text-slate-800">{coupon.description}</td>
                                    <td className="py-3 px-4 text-slate-800">{coupon.discount}%</td>
                                    <td className="py-3 px-4 text-slate-800">{format(new Date(coupon.expiresAt), 'yyyy-MM-dd')}</td>
                                    <td className="py-3 px-4 text-slate-800">{coupon.forNewUser ? 'Yes' : 'No'}</td>
                                    <td className="py-3 px-4 text-slate-800">{coupon.forMember ? 'Yes' : 'No'}</td>
                                    <td className="py-3 px-4">
                                        <DeleteIcon
                                            onClick={() => handleDelete(coupon.code)}
                                            className="w-5 h-5 text-red-500 hover:text-red-800 cursor-pointer"
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
