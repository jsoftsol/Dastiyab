import prisma from '@/lib/prisma'
import CouponsClient from './CouponsClient'

export default async function AdminCoupons() {
    const coupons = await prisma.coupon.findMany({
        orderBy: { createdAt: 'desc' },
    })

    const serialized = coupons.map(c => ({
        ...c,
        expiresAt: c.expiresAt.toISOString(),
        createdAt: c.createdAt.toISOString(),
    }))

    return <CouponsClient coupons={serialized} />
}
