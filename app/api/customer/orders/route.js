import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

export async function GET() {
  try {
    const { userId } = await getAuthUser()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const orders = await prisma.order.findMany({
      where: { userId },
      include: {
        orderItems: {
          include: {
            product: { select: { id: true, name: true, images: true, category: true } },
          },
        },
        address: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ orders })
  } catch (err) {
    console.error('[GET /api/customer/orders]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req) {
  try {
    const { userId } = await getAuthUser()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { addressId, couponCode, items } = await req.json()

    if (!addressId) return NextResponse.json({ error: 'Address is required' }, { status: 400 })
    if (!items || items.length === 0) return NextResponse.json({ error: 'Cart is empty' }, { status: 400 })

    const productIds = items.map(i => i.productId)
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, price: true, inStock: true, storeId: true },
    })

    const outOfStock = products.find(p => !p.inStock)
    if (outOfStock) {
      return NextResponse.json({ error: `${outOfStock.name} is out of stock` }, { status: 400 })
    }

    const productMap = Object.fromEntries(products.map(p => [p.id, p]))
    const enrichedItems = items.map(i => ({
      productId: i.productId,
      quantity: i.quantity,
      price: productMap[i.productId].price,
      storeId: productMap[i.productId].storeId,
    }))

    let couponData = {}
    let discountRate = 0
    if (couponCode) {
      const coupon = await prisma.coupon.findUnique({ where: { code: couponCode.toUpperCase() } })
      if (!coupon || new Date(coupon.expiresAt) < new Date()) {
        return NextResponse.json({ error: 'Coupon is invalid or expired' }, { status: 400 })
      }
      discountRate = coupon.discount / 100
      couponData = { code: coupon.code, discount: coupon.discount, description: coupon.description }
    }

    // Group items by store
    const byStore = {}
    for (const item of enrichedItems) {
      if (!byStore[item.storeId]) byStore[item.storeId] = []
      byStore[item.storeId].push(item)
    }

    const grandTotal = enrichedItems.reduce((sum, i) => sum + i.price * i.quantity, 0)

    const createdOrders = await prisma.$transaction(async (tx) => {
      const results = []
      for (const [storeId, storeItems] of Object.entries(byStore)) {
        const storeSubtotal = storeItems.reduce((sum, i) => sum + i.price * i.quantity, 0)
        const storeDiscount = grandTotal > 0
          ? (storeSubtotal / grandTotal) * discountRate * storeSubtotal
          : 0
        const storeTotal = parseFloat((storeSubtotal - storeDiscount).toFixed(2))

        const order = await tx.order.create({
          data: {
            total: storeTotal,
            userId,
            storeId,
            addressId,
            paymentMethod: 'COD',
            isCouponUsed: !!couponCode,
            coupon: couponData,
            orderItems: {
              create: storeItems.map(i => ({
                productId: i.productId,
                quantity: i.quantity,
                price: i.price,
              })),
            },
          },
          include: {
            orderItems: {
              include: {
                product: { select: { id: true, name: true, images: true, category: true } },
              },
            },
            address: true,
          },
        })
        results.push(order)
      }
      await tx.user.update({ where: { id: userId }, data: { cart: {} } })
      return results
    })

    return NextResponse.json({ orders: createdOrders }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/customer/orders]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
