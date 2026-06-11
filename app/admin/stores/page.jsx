import prisma from '@/lib/prisma'
import StoresClient from './StoresClient'

export default async function AdminStores() {
    const stores = await prisma.store.findMany({
        where: { status: 'approved' },
        include: { user: { select: { name: true, email: true, image: true } } },
        orderBy: { createdAt: 'desc' },
    })

    const serialized = stores.map(s => ({
        ...s,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
    }))

    return (
        <div className="text-slate-500 mb-28">
            <h1 className="text-2xl">Live <span className="text-slate-800 font-medium">Stores</span></h1>
            <StoresClient stores={serialized} />
        </div>
    )
}
