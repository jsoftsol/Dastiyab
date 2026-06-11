'use client'
import { useTransition } from 'react'
import { approveStore } from '@/app/admin/actions'
import StoreInfo from '@/components/admin/StoreInfo'
import toast from 'react-hot-toast'

export default function ApproveClient({ stores }) {
    const [isPending, startTransition] = useTransition()

    const handleApprove = (storeId, status) => {
        startTransition(async () => {
            const result = await approveStore(storeId, status)
            if (result?.error) toast.error(result.error)
            else toast.success(status === 'approved' ? 'Store approved' : 'Store rejected')
        })
    }

    if (!stores.length) {
        return (
            <div className="flex items-center justify-center h-80">
                <h1 className="text-3xl text-slate-400 font-medium">No Application Pending</h1>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-4 mt-4">
            {stores.map((store) => (
                <div key={store.id} className="bg-white border rounded-lg shadow-sm p-6 flex max-md:flex-col gap-4 md:items-end max-w-4xl">
                    <StoreInfo store={store} />
                    <div className="flex gap-3 pt-2 flex-wrap">
                        <button
                            disabled={isPending}
                            onClick={() => handleApprove(store.id, 'approved')}
                            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm disabled:opacity-50"
                        >
                            Approve
                        </button>
                        <button
                            disabled={isPending}
                            onClick={() => handleApprove(store.id, 'rejected')}
                            className="px-4 py-2 bg-slate-500 text-white rounded hover:bg-slate-600 text-sm disabled:opacity-50"
                        >
                            Reject
                        </button>
                    </div>
                </div>
            ))}
        </div>
    )
}
