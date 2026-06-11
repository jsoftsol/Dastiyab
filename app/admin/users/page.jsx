import prisma from '@/lib/prisma'

export default async function AdminUsers() {
    const users = await prisma.user.findMany({
        include: { store: { select: { name: true } } },
        orderBy: { id: 'asc' },
    })

    return (
        <div className="text-slate-500 mb-28">
            <h1 className="text-2xl">All <span className="text-slate-800 font-medium">Users</span></h1>
            <div className="overflow-x-auto mt-4 rounded-lg border border-slate-200 max-w-4xl">
                <table className="min-w-full bg-white text-sm">
                    <thead className="bg-slate-50">
                        <tr>
                            {['Name', 'Email', 'Role', 'Store'].map(h => (
                                <th key={h} className="py-3 px-4 text-left font-semibold text-slate-600">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {users.map((user) => (
                            <tr key={user.id} className="hover:bg-slate-50">
                                <td className="py-3 px-4 text-slate-800">{user.name || '—'}</td>
                                <td className="py-3 px-4 text-slate-800">{user.email}</td>
                                <td className="py-3 px-4">
                                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                                        user.role === 'admin'
                                            ? 'bg-red-100 text-red-700'
                                            : user.role === 'vendor'
                                            ? 'bg-blue-100 text-blue-700'
                                            : 'bg-slate-100 text-slate-600'
                                    }`}>
                                        {user.role}
                                    </span>
                                </td>
                                <td className="py-3 px-4 text-slate-800">{user.store?.name || '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
