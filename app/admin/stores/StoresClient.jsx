'use client'
import { useTransition } from 'react'
import { toggleStoreActive } from '@/app/admin/actions'
import StoreInfo from '@/components/admin/StoreInfo'
import toast from 'react-hot-toast'

export default function StoresClient({ stores }) {
    const [isPending, startTransition] = useTransition()

    const handleToggle = (storeId, currentIsActive) => {
        startTransition(async () => {
            const result = await toggleStoreActive(storeId, !currentIsActive)
            if (result?.error) toast.error(result.error)
        })
    }

    if (!stores.length) {
        return (
            <div className="flex items-center justify-center h-80">
                <h1 className="text-3xl text-slate-400 font-medium">No stores Available</h1>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-4 mt-4">
            {stores.map((store) => (
                <div key={store.id} className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 flex max-md:flex-col gap-4 md:items-end max-w-4xl">
                    <StoreInfo store={store} />
                    <div className="flex items-center gap-3 pt-2 flex-wrap">
                        <p>Active</p>
                        <label className="relative inline-flex items-center cursor-pointer text-gray-900">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={store.isActive}
                                disabled={isPending}
                                onChange={() => handleToggle(store.id, store.isActive)}
                            />
                            <div className="w-9 h-5 bg-slate-300 rounded-full peer peer-checked:bg-green-600 transition-colors duration-200"></div>
                            <span className="dot absolute left-1 top-1 w-3 h-3 bg-white rounded-full transition-transform duration-200 ease-in-out peer-checked:translate-x-4"></span>
                        </label>
                    </div>
                </div>
            ))}
        </div>
    )
}
