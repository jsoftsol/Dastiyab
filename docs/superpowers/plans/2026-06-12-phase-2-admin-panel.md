# Phase 2 — Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire all 6 admin panel pages to real PostgreSQL data using Next.js 16 server components and Server Actions — replacing all dummy data fetches and empty mutation handlers.

**Architecture:** Each page is an async server component that reads directly from Prisma. Mutations live in `app/admin/actions.js` as `'use server'` functions. Interactive UI is extracted to `*Client.jsx` client components that call those actions and use `useTransition` for loading state.

**Tech Stack:** Next.js 16 App Router, React 19, Prisma 7 (`@/lib/prisma`), Auth.js v5 (`requireAdmin` from `@/lib/auth`), `next/cache` (`revalidatePath`), `react-hot-toast`, `date-fns`, Tailwind CSS v4, Vitest

---

## File Map

### New files
| File | Responsibility |
|------|---------------|
| `app/admin/actions.js` | All `'use server'` mutations for the admin panel |
| `app/admin/stores/StoresClient.jsx` | Active toggle per store row |
| `app/admin/approve/ApproveClient.jsx` | Approve / Reject buttons per store row |
| `app/admin/coupons/CouponsClient.jsx` | Create coupon form + delete button |
| `app/admin/orders/page.jsx` | Orders list (async server component) |
| `app/admin/orders/OrdersClient.jsx` | Status dropdown per order row |
| `app/admin/users/page.jsx` | Users list (async server component, no client component) |
| `__tests__/admin/actions.test.js` | Unit tests for all server actions |

### Modified files
| File | Change |
|------|--------|
| `app/admin/page.jsx` | Remove `'use client'`, make async, direct Prisma reads |
| `app/admin/stores/page.jsx` | Remove `'use client'`, make async, render `StoresClient` |
| `app/admin/approve/page.jsx` | Remove `'use client'`, make async, render `ApproveClient` |
| `app/admin/coupons/page.jsx` | Remove `'use client'`, make async, render `CouponsClient` |
| `components/admin/AdminSidebar.jsx` | Add Orders + Users nav links |

---

## Task 1: Server Actions + Tests

**Files:**
- Create: `app/admin/actions.js`
- Create: `__tests__/admin/actions.test.js`

All 5 mutations in one `'use server'` file. Each checks `requireAdmin()` before touching the DB and returns `{ error: string }` on failure.

- [ ] **Step 1.1: Write the failing tests**

Create `__tests__/admin/actions.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  requireAdmin: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    store: { update: vi.fn() },
    coupon: { create: vi.fn(), delete: vi.fn() },
    order: { update: vi.fn() },
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { requireAdmin } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import {
  toggleStoreActive,
  approveStore,
  createCoupon,
  deleteCoupon,
  updateOrderStatus,
} from '@/app/admin/actions'

beforeEach(() => vi.clearAllMocks())

describe('toggleStoreActive', () => {
  it('returns error when not admin', async () => {
    requireAdmin.mockResolvedValue(null)
    const result = await toggleStoreActive('store_1', true)
    expect(result).toEqual({ error: 'Unauthorized' })
    expect(prisma.store.update).not.toHaveBeenCalled()
  })

  it('updates isActive and revalidates', async () => {
    requireAdmin.mockResolvedValue({ userId: 'u1', role: 'admin' })
    await toggleStoreActive('store_1', false)
    expect(prisma.store.update).toHaveBeenCalledWith({
      where: { id: 'store_1' },
      data: { isActive: false },
    })
    expect(revalidatePath).toHaveBeenCalledWith('/admin/stores')
  })
})

describe('approveStore', () => {
  it('returns error when not admin', async () => {
    requireAdmin.mockResolvedValue(null)
    expect(await approveStore('store_1', 'approved')).toEqual({ error: 'Unauthorized' })
  })

  it('sets status and isActive:true when approving', async () => {
    requireAdmin.mockResolvedValue({ userId: 'u1', role: 'admin' })
    await approveStore('store_1', 'approved')
    expect(prisma.store.update).toHaveBeenCalledWith({
      where: { id: 'store_1' },
      data: { status: 'approved', isActive: true },
    })
    expect(revalidatePath).toHaveBeenCalledWith('/admin/approve')
  })

  it('sets status only (no isActive) when rejecting', async () => {
    requireAdmin.mockResolvedValue({ userId: 'u1', role: 'admin' })
    await approveStore('store_1', 'rejected')
    expect(prisma.store.update).toHaveBeenCalledWith({
      where: { id: 'store_1' },
      data: { status: 'rejected' },
    })
  })
})

describe('createCoupon', () => {
  const couponData = {
    code: 'SAVE10', description: 'Test coupon', discount: '10',
    expiresAt: '2027-01-01', forNewUser: false, forMember: false, isPublic: true,
  }

  it('returns error when not admin', async () => {
    requireAdmin.mockResolvedValue(null)
    expect(await createCoupon(couponData)).toEqual({ error: 'Unauthorized' })
    expect(prisma.coupon.create).not.toHaveBeenCalled()
  })

  it('creates coupon with parsed types and revalidates', async () => {
    requireAdmin.mockResolvedValue({ userId: 'u1', role: 'admin' })
    await createCoupon(couponData)
    expect(prisma.coupon.create).toHaveBeenCalledWith({
      data: {
        code: 'SAVE10',
        description: 'Test coupon',
        discount: 10,
        expiresAt: new Date('2027-01-01'),
        forNewUser: false,
        forMember: false,
        isPublic: true,
      },
    })
    expect(revalidatePath).toHaveBeenCalledWith('/admin/coupons')
  })
})

describe('deleteCoupon', () => {
  it('returns error when not admin', async () => {
    requireAdmin.mockResolvedValue(null)
    expect(await deleteCoupon('SAVE10')).toEqual({ error: 'Unauthorized' })
  })

  it('deletes coupon and revalidates', async () => {
    requireAdmin.mockResolvedValue({ userId: 'u1', role: 'admin' })
    await deleteCoupon('SAVE10')
    expect(prisma.coupon.delete).toHaveBeenCalledWith({ where: { code: 'SAVE10' } })
    expect(revalidatePath).toHaveBeenCalledWith('/admin/coupons')
  })
})

describe('updateOrderStatus', () => {
  it('returns error when not admin', async () => {
    requireAdmin.mockResolvedValue(null)
    expect(await updateOrderStatus('order_1', 'PROCESSING')).toEqual({ error: 'Unauthorized' })
  })

  it('updates status and revalidates', async () => {
    requireAdmin.mockResolvedValue({ userId: 'u1', role: 'admin' })
    await updateOrderStatus('order_1', 'SHIPPED')
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order_1' },
      data: { status: 'SHIPPED' },
    })
    expect(revalidatePath).toHaveBeenCalledWith('/admin/orders')
  })
})
```

- [ ] **Step 1.2: Run tests — expect all to fail (module not found)**

```bash
npx vitest run __tests__/admin/actions.test.js
```

Expected: FAIL — `Cannot find module '@/app/admin/actions'`

- [ ] **Step 1.3: Create `app/admin/actions.js`**

```js
'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export async function toggleStoreActive(storeId, isActive) {
  const admin = await requireAdmin()
  if (!admin) return { error: 'Unauthorized' }

  await prisma.store.update({
    where: { id: storeId },
    data: { isActive },
  })

  revalidatePath('/admin/stores')
}

export async function approveStore(storeId, status) {
  const admin = await requireAdmin()
  if (!admin) return { error: 'Unauthorized' }

  await prisma.store.update({
    where: { id: storeId },
    data: {
      status,
      ...(status === 'approved' && { isActive: true }),
    },
  })

  revalidatePath('/admin/approve')
}

export async function createCoupon(couponData) {
  const admin = await requireAdmin()
  if (!admin) return { error: 'Unauthorized' }

  await prisma.coupon.create({
    data: {
      code: couponData.code,
      description: couponData.description,
      discount: parseFloat(couponData.discount),
      expiresAt: new Date(couponData.expiresAt),
      forNewUser: Boolean(couponData.forNewUser),
      forMember: Boolean(couponData.forMember),
      isPublic: Boolean(couponData.isPublic),
    },
  })

  revalidatePath('/admin/coupons')
}

export async function deleteCoupon(code) {
  const admin = await requireAdmin()
  if (!admin) return { error: 'Unauthorized' }

  await prisma.coupon.delete({ where: { code } })

  revalidatePath('/admin/coupons')
}

export async function updateOrderStatus(orderId, status) {
  const admin = await requireAdmin()
  if (!admin) return { error: 'Unauthorized' }

  await prisma.order.update({
    where: { id: orderId },
    data: { status },
  })

  revalidatePath('/admin/orders')
}
```

- [ ] **Step 1.4: Run tests — expect all to pass**

```bash
npx vitest run __tests__/admin/actions.test.js
```

Expected: PASS — 10 tests across 5 describe blocks

- [ ] **Step 1.5: Run full suite — confirm no regressions**

```bash
npx vitest run
```

Expected: all 25 tests pass (14 existing + 11 new)

- [ ] **Step 1.6: Commit**

```bash
git add app/admin/actions.js __tests__/admin/actions.test.js
git commit -m "feat: add admin server actions with auth guard"
```

---

## Task 2: Sidebar — Add Orders + Users Links

**Files:**
- Modify: `components/admin/AdminSidebar.jsx`

- [ ] **Step 2.1: Update `components/admin/AdminSidebar.jsx`**

Replace the entire file:

```jsx
'use client'

import { usePathname } from "next/navigation"
import { HomeIcon, ShieldCheckIcon, StoreIcon, TicketPercentIcon, ShoppingCartIcon, UsersIcon } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { assets } from "@/assets/assets"

const AdminSidebar = () => {
    const pathname = usePathname()

    const sidebarLinks = [
        { name: 'Dashboard', href: '/admin', icon: HomeIcon },
        { name: 'Stores', href: '/admin/stores', icon: StoreIcon },
        { name: 'Approve Store', href: '/admin/approve', icon: ShieldCheckIcon },
        { name: 'Coupons', href: '/admin/coupons', icon: TicketPercentIcon },
        { name: 'Orders', href: '/admin/orders', icon: ShoppingCartIcon },
        { name: 'Users', href: '/admin/users', icon: UsersIcon },
    ]

    return (
        <div className="inline-flex h-full flex-col gap-5 border-r border-slate-200 sm:min-w-60">
            <div className="flex flex-col gap-3 justify-center items-center pt-8 max-sm:hidden">
                <Image className="w-14 h-14 rounded-full" src={assets.gs_logo} alt="" width={80} height={80} />
                <p className="text-slate-700">Hi, GreatStack</p>
            </div>

            <div className="max-sm:mt-6">
                {sidebarLinks.map((link, index) => (
                    <Link key={index} href={link.href} className={`relative flex items-center gap-3 text-slate-500 hover:bg-slate-50 p-2.5 transition ${pathname === link.href && 'bg-slate-100 sm:text-slate-600'}`}>
                        <link.icon size={18} className="sm:ml-5" />
                        <p className="max-sm:hidden">{link.name}</p>
                        {pathname === link.href && <span className="absolute bg-green-500 right-0 top-1.5 bottom-1.5 w-1 sm:w-1.5 rounded-l"></span>}
                    </Link>
                ))}
            </div>
        </div>
    )
}

export default AdminSidebar
```

- [ ] **Step 2.2: Commit**

```bash
git add components/admin/AdminSidebar.jsx
git commit -m "feat: add Orders and Users links to admin sidebar"
```

---

## Task 3: Dashboard Page Conversion

**Files:**
- Modify: `app/admin/page.jsx`

`OrdersAreaChart` is already `'use client'` — a server component can import and render it directly by passing serialized data as props.

- [ ] **Step 3.1: Replace `app/admin/page.jsx`**

```jsx
import prisma from '@/lib/prisma'
import OrdersAreaChart from '@/components/OrdersAreaChart'
import { CircleDollarSignIcon, ShoppingBasketIcon, StoreIcon, TagsIcon } from 'lucide-react'

export default async function AdminDashboard() {
    const currency = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || '$'

    const [productCount, revenueAgg, orderCount, storeCount, allOrders] = await Promise.all([
        prisma.product.count(),
        prisma.order.aggregate({ _sum: { total: true } }),
        prisma.order.count(),
        prisma.store.count({ where: { status: 'approved' } }),
        prisma.order.findMany({ select: { createdAt: true, total: true } }),
    ])

    const revenue = revenueAgg._sum.total ?? 0

    const dashboardCardsData = [
        { title: 'Total Products', value: productCount, icon: ShoppingBasketIcon },
        { title: 'Total Revenue', value: currency + revenue.toFixed(2), icon: CircleDollarSignIcon },
        { title: 'Total Orders', value: orderCount, icon: TagsIcon },
        { title: 'Total Stores', value: storeCount, icon: StoreIcon },
    ]

    const serializedOrders = allOrders.map(o => ({
        ...o,
        createdAt: o.createdAt.toISOString(),
    }))

    return (
        <div className="text-slate-500">
            <h1 className="text-2xl">Admin <span className="text-slate-800 font-medium">Dashboard</span></h1>

            <div className="flex flex-wrap gap-5 my-10 mt-4">
                {dashboardCardsData.map((card, index) => (
                    <div key={index} className="flex items-center gap-10 border border-slate-200 p-3 px-6 rounded-lg">
                        <div className="flex flex-col gap-3 text-xs">
                            <p>{card.title}</p>
                            <b className="text-2xl font-medium text-slate-700">{card.value}</b>
                        </div>
                        <card.icon size={50} className="w-11 h-11 p-2.5 text-slate-400 bg-slate-100 rounded-full" />
                    </div>
                ))}
            </div>

            <OrdersAreaChart allOrders={serializedOrders} />
        </div>
    )
}
```

- [ ] **Step 3.2: Start dev server and verify the dashboard loads**

```bash
npm run dev
```

Navigate to `http://localhost:3000/admin`. Confirm:
- 4 stat cards show real counts (0s are fine if DB is empty)
- Chart renders without errors
- No `useEffect`, `useState`, or `Loading` component in use

- [ ] **Step 3.3: Commit**

```bash
git add app/admin/page.jsx
git commit -m "feat: convert admin dashboard to server component with real Prisma data"
```

---

## Task 4: Stores Page Conversion

**Files:**
- Modify: `app/admin/stores/page.jsx`
- Create: `app/admin/stores/StoresClient.jsx`

The `StoreInfo` component (`'use client'`) is reused as-is inside `StoresClient`.

- [ ] **Step 4.1: Create `app/admin/stores/StoresClient.jsx`**

```jsx
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
```

- [ ] **Step 4.2: Replace `app/admin/stores/page.jsx`**

```jsx
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
```

- [ ] **Step 4.3: Verify in browser**

Navigate to `http://localhost:3000/admin/stores`. Confirm:
- Real stores load (empty state message if none)
- Toggle calls the server action (check network tab or add a test store via DB)
- No JavaScript errors in console

- [ ] **Step 4.4: Commit**

```bash
git add app/admin/stores/page.jsx app/admin/stores/StoresClient.jsx
git commit -m "feat: convert admin stores page to server component + StoresClient"
```

---

## Task 5: Approve Page Conversion

**Files:**
- Modify: `app/admin/approve/page.jsx`
- Create: `app/admin/approve/ApproveClient.jsx`

- [ ] **Step 5.1: Create `app/admin/approve/ApproveClient.jsx`**

```jsx
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
```

- [ ] **Step 5.2: Replace `app/admin/approve/page.jsx`**

```jsx
import prisma from '@/lib/prisma'
import ApproveClient from './ApproveClient'

export default async function AdminApprove() {
    const stores = await prisma.store.findMany({
        where: { status: 'pending' },
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
            <h1 className="text-2xl">Approve <span className="text-slate-800 font-medium">Stores</span></h1>
            <ApproveClient stores={serialized} />
        </div>
    )
}
```

- [ ] **Step 5.3: Verify in browser**

Navigate to `http://localhost:3000/admin/approve`. Confirm:
- Pending stores list (or empty state)
- Approve/Reject buttons are disabled during transition
- No console errors

- [ ] **Step 5.4: Commit**

```bash
git add app/admin/approve/page.jsx app/admin/approve/ApproveClient.jsx
git commit -m "feat: convert admin approve page to server component + ApproveClient"
```

---

## Task 6: Coupons Page Conversion

**Files:**
- Modify: `app/admin/coupons/page.jsx`
- Create: `app/admin/coupons/CouponsClient.jsx`

The existing page manages form state with React `useState`. That state stays in the client component. The server component only fetches the coupon list.

- [ ] **Step 6.1: Create `app/admin/coupons/CouponsClient.jsx`**

```jsx
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
```

- [ ] **Step 6.2: Replace `app/admin/coupons/page.jsx`**

```jsx
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
```

- [ ] **Step 6.3: Verify in browser**

Navigate to `http://localhost:3000/admin/coupons`. Confirm:
- Form renders with all fields
- Submitting creates a coupon (toast success, coupon appears in list)
- Delete button removes a coupon
- Button shows "Adding..." during pending state

- [ ] **Step 6.4: Commit**

```bash
git add app/admin/coupons/page.jsx app/admin/coupons/CouponsClient.jsx
git commit -m "feat: convert admin coupons page to server component + CouponsClient"
```

---

## Task 7: Orders Page (New)

**Files:**
- Create: `app/admin/orders/page.jsx`
- Create: `app/admin/orders/OrdersClient.jsx`

- [ ] **Step 7.1: Create `app/admin/orders/OrdersClient.jsx`**

```jsx
'use client'
import { useTransition } from 'react'
import { updateOrderStatus } from '@/app/admin/actions'
import toast from 'react-hot-toast'

const ORDER_STATUSES = ['ORDER_PLACED', 'PROCESSING', 'SHIPPED', 'DELIVERED']

export default function OrdersClient({ orders }) {
    const [isPending, startTransition] = useTransition()

    const handleStatusChange = (orderId, status) => {
        startTransition(async () => {
            const result = await updateOrderStatus(orderId, status)
            if (result?.error) toast.error(result.error)
        })
    }

    if (!orders.length) {
        return (
            <div className="flex items-center justify-center h-80">
                <h1 className="text-3xl text-slate-400 font-medium">No Orders Yet</h1>
            </div>
        )
    }

    return (
        <div className="overflow-x-auto mt-4 rounded-lg border border-slate-200 max-w-6xl">
            <table className="min-w-full bg-white text-sm">
                <thead className="bg-slate-50">
                    <tr>
                        {['Order ID', 'Customer', 'Store', 'Items', 'Total', 'Payment', 'Status', 'Date'].map(h => (
                            <th key={h} className="py-3 px-4 text-left font-semibold text-slate-600">{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                    {orders.map((order) => (
                        <tr key={order.id} className="hover:bg-slate-50">
                            <td className="py-3 px-4 font-mono text-xs text-slate-600">{order.id.slice(0, 8)}…</td>
                            <td className="py-3 px-4 text-slate-800">{order.user.name || order.user.email}</td>
                            <td className="py-3 px-4 text-slate-800">{order.store.name}</td>
                            <td className="py-3 px-4 text-slate-800">{order.orderItems.length}</td>
                            <td className="py-3 px-4 text-slate-800">${order.total.toFixed(2)}</td>
                            <td className="py-3 px-4 text-slate-800">{order.paymentMethod}</td>
                            <td className="py-3 px-4">
                                <select
                                    value={order.status}
                                    disabled={isPending}
                                    onChange={(e) => handleStatusChange(order.id, e.target.value)}
                                    className="border border-slate-200 rounded p-1 text-xs text-slate-700 disabled:opacity-50"
                                >
                                    {ORDER_STATUSES.map(s => (
                                        <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                                    ))}
                                </select>
                            </td>
                            <td className="py-3 px-4 text-slate-500 text-xs">
                                {new Date(order.createdAt).toLocaleDateString()}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
```

- [ ] **Step 7.2: Create `app/admin/orders/page.jsx`**

```jsx
import prisma from '@/lib/prisma'
import OrdersClient from './OrdersClient'

export default async function AdminOrders() {
    const orders = await prisma.order.findMany({
        include: {
            user: { select: { name: true, email: true } },
            store: { select: { name: true } },
            orderItems: { include: { product: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
    })

    const serialized = orders.map(o => ({
        ...o,
        createdAt: o.createdAt.toISOString(),
        updatedAt: o.updatedAt.toISOString(),
    }))

    return (
        <div className="text-slate-500 mb-28">
            <h1 className="text-2xl">All <span className="text-slate-800 font-medium">Orders</span></h1>
            <OrdersClient orders={serialized} />
        </div>
    )
}
```

- [ ] **Step 7.3: Verify in browser**

Navigate to `http://localhost:3000/admin/orders`. Confirm:
- Orders table renders (or empty state)
- Status dropdown is present per row
- Changing a status calls the action (refresh page to confirm persistence)

- [ ] **Step 7.4: Commit**

```bash
git add app/admin/orders/page.jsx app/admin/orders/OrdersClient.jsx
git commit -m "feat: add admin orders page with server component + OrdersClient"
```

---

## Task 8: Users Page (New)

**Files:**
- Create: `app/admin/users/page.jsx`

View-only page — no client component needed.

- [ ] **Step 8.1: Create `app/admin/users/page.jsx`**

```jsx
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
```

- [ ] **Step 8.2: Verify in browser**

Navigate to `http://localhost:3000/admin/users`. Confirm:
- Users table shows all registered users
- Role badge is colour-coded (red = admin, blue = vendor, grey = customer)
- Store column shows store name for vendors, `—` for others

- [ ] **Step 8.3: Run full test suite**

```bash
npx vitest run
```

Expected: all 25 tests pass

- [ ] **Step 8.4: Commit**

```bash
git add app/admin/users/page.jsx
git commit -m "feat: add admin users page as server component"
```

---

## Task 9: Update CONTEXT.md

- [ ] **Step 9.1: Update `CONTEXT.md`**

Change Phase 2 status from `🔲 Not started` to `✅ Complete`. Update "Current phase" to Phase 3. Update "Last session ended" line. Add Phase 2 checklist as complete.

- [ ] **Step 9.2: Commit**

```bash
git add CONTEXT.md
git commit -m "chore: mark Phase 2 admin panel complete in CONTEXT.md"
```
