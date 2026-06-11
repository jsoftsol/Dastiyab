# Auth.js v5 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `@clerk/nextjs` with Auth.js v5 (`next-auth@beta`) + Prisma adapter, supporting Google OAuth and email/password credentials with roles stored in the database.

**Architecture:** Auth.js v5 is configured in a root `auth.js` file that exports `{ handlers, auth, signIn, signOut }`. JWT session strategy is used (required for Credentials + OAuth mix). Roles live in `User.role` (Prisma), stamped onto the JWT at sign-in via callbacks, and read from `session.user.role` everywhere.

**Tech Stack:** `next-auth@beta`, `@auth/prisma-adapter`, `bcryptjs`, Prisma 6, PostgreSQL, Vitest

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `package.json` | Modify | Remove `@clerk/nextjs`, add `next-auth@beta`, `@auth/prisma-adapter`, `bcryptjs` |
| `prisma/schema.prisma` | Modify | Add `Account`, `Session`, `VerificationToken` models; update `User` |
| `auth.js` | Create | Central NextAuth config — providers, callbacks, adapter |
| `app/api/auth/[...nextauth]/route.js` | Create | Thin handler: exports `{ GET, POST }` from `auth.js` |
| `app/api/auth/register/route.js` | Create | Registration endpoint — hash password, create user |
| `middleware.js` | Replace | Auth.js route protection replacing `clerkMiddleware` |
| `lib/auth.js` | Replace | `requireAdmin`, `requireVendor`, `getAuthUser` using NextAuth `auth()` |
| `app/AuthProvider.jsx` | Create | Client-side `SessionProvider` wrapper |
| `app/layout.jsx` | Modify | Swap `ClerkProvider` → `AuthProvider` |
| `components/admin/ui/UserMenu.jsx` | Create | Dropdown with user info + sign out (replaces `<UserButton />`) |
| `components/admin/AdminNavbar.jsx` | Modify | Replace static "Hi, Admin" with `<UserMenu />` |
| `components/store/StoreNavbar.jsx` | Modify | Replace static "Hi, Seller" with `<UserMenu />` |
| `app/sign-in/[[...sign-in]]/page.jsx` | Replace | Custom form: sign-in tab + sign-up tab + Google button |
| `.env.local` | Modify | Swap Clerk vars for NextAuth + Google vars |
| `.env.example` | Modify | Same swap for reference |
| `__tests__/lib/auth.test.js` | Replace | Re-mock `@/auth` instead of `@clerk/nextjs/server` |

---

## Task 1: Swap Dependencies

**Files:**
- Modify: `package.json` (via npm)

- [ ] **Step 1: Remove Clerk and install NextAuth packages**

```bash
npm uninstall @clerk/nextjs
npm install next-auth@beta @auth/prisma-adapter bcryptjs
npm install -D @types/bcryptjs
```

- [ ] **Step 2: Verify installed versions**

```bash
npm list next-auth @auth/prisma-adapter bcryptjs
```

Expected output includes `next-auth@5.x.x`, `@auth/prisma-adapter@1.x.x`, `bcryptjs@2.x.x`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: swap @clerk/nextjs for next-auth@beta + prisma adapter + bcryptjs"
```

---

## Task 2: Update Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Replace the full schema file**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  image         String?
  password      String?
  role          String    @default("customer")
  cart          Json      @default("{}")

  accounts    Account[]
  sessions    Session[]
  ratings     Rating[]
  Address     Address[]
  store       Store?
  buyerOrders Order[]   @relation("BuyerRelation")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

model Product {
  id          String   @id @default(cuid())
  name        String
  description String
  mrp         Float
  price       Float
  images      String[]
  category    String
  inStock     Boolean  @default(true)
  storeId     String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  store      Store       @relation(fields: [storeId], references: [id], onDelete: Cascade)
  orderItems OrderItem[]
  rating     Rating[]
}

enum OrderStatus {
  ORDER_PLACED
  PROCESSING
  SHIPPED
  DELIVERED
}

enum PaymentMethod {
  COD
  STRIPE
}

model Order {
  id            String        @id @default(cuid())
  total         Float
  status        OrderStatus   @default(ORDER_PLACED)
  userId        String
  storeId       String
  addressId     String
  isPaid        Boolean       @default(false)
  paymentMethod PaymentMethod
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  isCouponUsed  Boolean       @default(false)
  coupon        Json          @default("{}")
  orderItems    OrderItem[]

  user    User    @relation("BuyerRelation", fields: [userId], references: [id])
  store   Store   @relation(fields: [storeId], references: [id])
  address Address @relation(fields: [addressId], references: [id])
}

model OrderItem {
  orderId   String
  productId String
  quantity  Int
  price     Float

  order   Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product Product @relation(fields: [productId], references: [id])

  @@id([orderId, productId])
}

model Rating {
  id        String   @id @default(cuid())
  rating    Int
  review    String
  userId    String
  productId String
  orderId   String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@unique([userId, productId, orderId])
}

model Address {
  id        String   @id @default(cuid())
  userId    String
  name      String
  email     String
  street    String
  city      String
  state     String
  zip       String
  country   String
  phone     String
  createdAt DateTime @default(now())

  Order Order[]
  user  User    @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Coupon {
  code        String   @id
  description String
  discount    Float
  forNewUser  Boolean
  forMember   Boolean  @default(false)
  isPublic    Boolean
  expiresAt   DateTime
  createdAt   DateTime @default(now())
}

model Store {
  id          String   @id @default(cuid())
  userId      String   @unique
  name        String
  description String
  username    String   @unique
  address     String
  status      String   @default("pending")
  isActive    Boolean  @default(false)
  logo        String
  email       String
  contact     String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  Product Product[]
  Order   Order[]
  user    User      @relation(fields: [userId], references: [id])
}
```

- [ ] **Step 2: Push schema to DB (force reset — dev data is all test data)**

```bash
npx prisma db push --force-reset
```

Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 3: Regenerate Prisma client**

```bash
npx prisma generate
```

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: update prisma schema for nextauth — add Account/Session/VerificationToken, update User"
```

---

## Task 3: Create `auth.js`

**Files:**
- Create: `auth.js` (project root)

- [ ] **Step 1: Create the file**

```js
import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const user = await prisma.user.findUnique({
          where: { email: String(credentials.email) },
        })
        if (!user || !user.password) return null
        const isValid = await bcrypt.compare(
          String(credentials.password),
          user.password
        )
        if (!isValid) return null
        return user
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.role = token.role
        session.user.id = token.id
      }
      return session
    },
  },
  pages: {
    signIn: '/sign-in',
  },
})
```

- [ ] **Step 2: Verify no syntax errors**

```bash
node --input-type=module --eval "import('./auth.js').then(() => console.log('ok')).catch(e => { console.error(e.message); process.exit(1) })"
```

Expected: `ok` (or a benign "missing env vars" warning — not a syntax error)

- [ ] **Step 3: Commit**

```bash
git add auth.js
git commit -m "feat: add auth.js — nextauth v5 config with google + credentials providers"
```

---

## Task 4: Create Auth API Route Handler

**Files:**
- Create: `app/api/auth/[...nextauth]/route.js`

- [ ] **Step 1: Create the directory and file**

```bash
mkdir -p app/api/auth/\[...nextauth\]
```

```js
// app/api/auth/[...nextauth]/route.js
import { handlers } from '@/auth'
export const { GET, POST } = handlers
```

- [ ] **Step 2: Commit**

```bash
git add "app/api/auth/[...nextauth]/route.js"
git commit -m "feat: add nextauth api route handler"
```

---

## Task 5: Create Registration Endpoint

**Files:**
- Create: `app/api/auth/register/route.js`

- [ ] **Step 1: Write the failing test**

Create `__tests__/api/register.test.js` (new file — do not modify auth.test.js):

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST as registerPOST } from '@/app/api/auth/register/route'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}))

import prisma from '@/lib/prisma'

describe('POST /api/auth/register', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when fields are missing', async () => {
    const req = new NextRequest('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'a@b.com' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await registerPOST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('returns 400 when email already exists', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'existing' })
    const req = new NextRequest('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'Chad', email: 'chad@test.com', password: 'pass123' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await registerPOST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/already/i)
  })

  it('creates user and returns success', async () => {
    prisma.user.findUnique.mockResolvedValue(null)
    prisma.user.create.mockResolvedValue({ id: 'new-user' })
    const req = new NextRequest('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'Chad', email: 'chad@test.com', password: 'pass123' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await registerPOST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: 'customer', email: 'chad@test.com' }),
      })
    )
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run __tests__/api/register.test.js
```

Expected: all three register tests fail with "Cannot find module `@/app/api/auth/register/route`".

- [ ] **Step 3: Create the route**

```js
// app/api/auth/register/route.js
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'

export async function POST(req) {
  const { name, email, password } = await req.json()

  if (!name || !email || !password) {
    return NextResponse.json(
      { error: 'Name, email and password are required' },
      { status: 400 }
    )
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json(
      { error: 'Email already registered' },
      { status: 400 }
    )
  }

  const hash = await bcrypt.hash(password, 12)
  await prisma.user.create({
    data: { name, email, password: hash, role: 'customer' },
  })

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run __tests__/api/register.test.js
```

Expected: all three register tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/api/auth/register/route.js __tests__/api/register.test.js
git commit -m "feat: add registration endpoint with bcrypt password hashing"
```

---

## Task 6: Replace Middleware

**Files:**
- Replace: `middleware.js`

- [ ] **Step 1: Replace the file**

```js
import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const session = req.auth
  const { pathname } = req.nextUrl
  const isApi = pathname.startsWith('/api/')

  const isAdminRoute = pathname.startsWith('/admin') || pathname.startsWith('/api/admin')
  const isVendorRoute = pathname.startsWith('/store') || pathname.startsWith('/api/store')
  const isProtectedRoute = pathname === '/orders'

  if ((isAdminRoute || isVendorRoute || isProtectedRoute) && !session) {
    if (isApi) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.redirect(new URL('/sign-in', req.url))
  }

  if (isAdminRoute && session?.user?.role !== 'admin') {
    if (isApi) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    return NextResponse.redirect(new URL('/', req.url))
  }

  if (isVendorRoute && session?.user?.role !== 'vendor') {
    if (isApi) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    return NextResponse.redirect(new URL('/', req.url))
  }
})

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
}
```

- [ ] **Step 2: Commit**

```bash
git add middleware.js
git commit -m "feat: replace clerkMiddleware with nextauth auth middleware"
```

---

## Task 7: Replace Auth Helpers

**Files:**
- Replace: `lib/auth.js`
- Replace: `__tests__/lib/auth.test.js`

- [ ] **Step 1: Replace the test file first**

```js
// __tests__/lib/auth.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

import { auth } from '@/auth'
import { requireAdmin, requireVendor, getAuthUser } from '@/lib/auth'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('requireAdmin', () => {
  it('returns null when unauthenticated', async () => {
    auth.mockResolvedValue(null)
    expect(await requireAdmin()).toBeNull()
  })

  it('returns null when user has vendor role', async () => {
    auth.mockResolvedValue({ user: { id: 'user_123', role: 'vendor' } })
    expect(await requireAdmin()).toBeNull()
  })

  it('returns user data when user has admin role', async () => {
    auth.mockResolvedValue({ user: { id: 'user_123', role: 'admin' } })
    const result = await requireAdmin()
    expect(result).toEqual({ userId: 'user_123', role: 'admin' })
  })
})

describe('requireVendor', () => {
  it('returns null when unauthenticated', async () => {
    auth.mockResolvedValue(null)
    expect(await requireVendor()).toBeNull()
  })

  it('returns null when user has admin role', async () => {
    auth.mockResolvedValue({ user: { id: 'user_123', role: 'admin' } })
    expect(await requireVendor()).toBeNull()
  })

  it('returns user data when user has vendor role', async () => {
    auth.mockResolvedValue({ user: { id: 'user_123', role: 'vendor' } })
    const result = await requireVendor()
    expect(result).toEqual({ userId: 'user_123', role: 'vendor' })
  })
})

describe('getAuthUser', () => {
  it('returns null userId and null role when unauthenticated', async () => {
    auth.mockResolvedValue(null)
    const result = await getAuthUser()
    expect(result).toEqual({ userId: null, role: null })
  })

  it('returns userId and role when authenticated', async () => {
    auth.mockResolvedValue({ user: { id: 'user_456', role: 'customer' } })
    const result = await getAuthUser()
    expect(result).toEqual({ userId: 'user_456', role: 'customer' })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run __tests__/lib/auth.test.js
```

Expected: tests fail with "Cannot find module `@clerk/nextjs/server`" — `@clerk/nextjs` was removed in Task 1 so `lib/auth.js` can no longer be imported. This confirms the test is actually exercising the real module.

- [ ] **Step 3: Replace `lib/auth.js`**

```js
import { auth } from '@/auth'

export async function requireAdmin() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'admin') return null
  return { userId: session.user.id, role: session.user.role }
}

export async function requireVendor() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'vendor') return null
  return { userId: session.user.id, role: session.user.role }
}

export async function getAuthUser() {
  const session = await auth()
  return {
    userId: session?.user?.id ?? null,
    role: session?.user?.role ?? null,
  }
}
```

- [ ] **Step 4: Run the full test suite to verify all pass**

```bash
npx vitest run
```

Expected: all tests pass (smoke + auth helpers + prisma + cloudinary).

- [ ] **Step 5: Commit**

```bash
git add lib/auth.js __tests__/lib/auth.test.js
git commit -m "feat: replace clerk auth helpers with nextauth session-based helpers"
```

---

## Task 8: Add SessionProvider and Update Layout

**Files:**
- Create: `app/AuthProvider.jsx`
- Modify: `app/layout.jsx`

- [ ] **Step 1: Create `app/AuthProvider.jsx`**

```jsx
'use client'
import { SessionProvider } from 'next-auth/react'

export default function AuthProvider({ children }) {
  return <SessionProvider>{children}</SessionProvider>
}
```

- [ ] **Step 2: Update `app/layout.jsx`**

```jsx
import { Outfit } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import StoreProvider from '@/app/StoreProvider'
import AuthProvider from '@/app/AuthProvider'
import './globals.css'

const outfit = Outfit({ subsets: ['latin'], weight: ['400', '500', '600'] })

export const metadata = {
  title: 'GoCart. - Shop smarter',
  description: 'GoCart. - Shop smarter',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${outfit.className} antialiased`}>
        <AuthProvider>
          <StoreProvider>
            <Toaster />
            {children}
          </StoreProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/AuthProvider.jsx app/layout.jsx
git commit -m "feat: replace ClerkProvider with SessionProvider wrapper"
```

---

## Task 9: Create UserMenu Component

**Files:**
- Create: `components/admin/ui/UserMenu.jsx`

- [ ] **Step 1: Create the component**

```jsx
'use client'
import { useSession, signOut } from 'next-auth/react'
import Image from 'next/image'
import { useState, useEffect, useRef } from 'react'

export default function UserMenu() {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!session?.user) return null

  const { name, email, image } = session.user
  const initials = name ? name.charAt(0).toUpperCase() : '?'

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 focus:outline-none"
      >
        {image ? (
          <Image
            src={image}
            alt={name || 'User'}
            width={32}
            height={32}
            className="rounded-full object-cover"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-sm font-semibold">
            {initials}
          </div>
        )}
        <span className="hidden sm:block text-sm font-medium text-slate-700">
          {name || email}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-slate-200 z-50">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-medium text-slate-800 truncate">{name}</p>
            <p className="text-xs text-slate-500 truncate">{email}</p>
          </div>
          <div className="p-1">
            <button
              onClick={() => signOut({ callbackUrl: '/sign-in' })}
              className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/admin/ui/UserMenu.jsx
git commit -m "feat: add UserMenu component — replaces Clerk UserButton in admin/vendor navbars"
```

---

## Task 10: Update AdminNavbar and StoreNavbar

**Files:**
- Modify: `components/admin/AdminNavbar.jsx`
- Modify: `components/store/StoreNavbar.jsx`

- [ ] **Step 1: Update `components/admin/AdminNavbar.jsx`**

```jsx
'use client'
import Link from 'next/link'
import UserMenu from '@/components/admin/ui/UserMenu'

const AdminNavbar = () => {
  return (
    <div className="flex items-center justify-between px-12 py-3 border-b border-slate-200 transition-all">
      <Link href="/" className="relative text-4xl font-semibold text-slate-700">
        <span className="text-green-600">go</span>cart<span className="text-green-600 text-5xl leading-0">.</span>
        <p className="absolute text-xs font-semibold -top-1 -right-13 px-3 p-0.5 rounded-full flex items-center gap-2 text-white bg-green-500">
          Admin
        </p>
      </Link>
      <div className="flex items-center gap-3">
        <UserMenu />
      </div>
    </div>
  )
}

export default AdminNavbar
```

- [ ] **Step 2: Update `components/store/StoreNavbar.jsx`**

```jsx
'use client'
import Link from 'next/link'
import UserMenu from '@/components/admin/ui/UserMenu'

const StoreNavbar = () => {
  return (
    <div className="flex items-center justify-between px-12 py-3 border-b border-slate-200 transition-all">
      <Link href="/" className="relative text-4xl font-semibold text-slate-700">
        <span className="text-green-600">go</span>cart<span className="text-green-600 text-5xl leading-0">.</span>
        <p className="absolute text-xs font-semibold -top-1 -right-11 px-3 p-0.5 rounded-full flex items-center gap-2 text-white bg-green-500">
          Store
        </p>
      </Link>
      <div className="flex items-center gap-3">
        <UserMenu />
      </div>
    </div>
  )
}

export default StoreNavbar
```

- [ ] **Step 3: Commit**

```bash
git add components/admin/AdminNavbar.jsx components/store/StoreNavbar.jsx
git commit -m "feat: replace static user text with UserMenu in admin and store navbars"
```

---

## Task 11: Replace Sign-in Page

**Files:**
- Replace: `app/sign-in/[[...sign-in]]/page.jsx`

- [ ] **Step 1: Replace the file**

```jsx
'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function SignInPage() {
  const [tab, setTab] = useState('signin')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSignIn(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const form = new FormData(e.target)
    const result = await signIn('credentials', {
      email: form.get('email'),
      password: form.get('password'),
      redirect: false,
    })
    setLoading(false)
    if (result?.error) {
      setError('Invalid email or password')
      return
    }
    const res = await fetch('/api/auth/session')
    const session = await res.json()
    const role = session?.user?.role
    if (role === 'admin') router.push('/admin')
    else if (role === 'vendor') router.push('/store')
    else router.push('/')
  }

  async function handleSignUp(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const form = new FormData(e.target)
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.get('name'),
        email: form.get('email'),
        password: form.get('password'),
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setLoading(false)
      setError(data.error || 'Registration failed')
      return
    }
    const result = await signIn('credentials', {
      email: form.get('email'),
      password: form.get('password'),
      redirect: false,
    })
    setLoading(false)
    if (result?.error) {
      setError('Account created — please sign in')
      setTab('signin')
      return
    }
    router.push('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8">
        <h1 className="text-3xl font-semibold text-slate-700 mb-6 text-center">
          <span className="text-green-600">go</span>cart<span className="text-green-600 text-4xl leading-0">.</span>
        </h1>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 mb-6">
          <button
            onClick={() => { setTab('signin'); setError('') }}
            className={`flex-1 pb-2 text-sm font-medium transition-colors ${
              tab === 'signin'
                ? 'border-b-2 border-green-500 text-green-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setTab('signup'); setError('') }}
            className={`flex-1 pb-2 text-sm font-medium transition-colors ${
              tab === 'signup'
                ? 'border-b-2 border-green-500 text-green-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Sign Up
          </button>
        </div>

        {error && (
          <p className="mb-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
        )}

        {tab === 'signin' ? (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                name="email"
                type="email"
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input
                name="password"
                type="password"
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignUp} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
              <input
                name="name"
                type="text"
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                name="email"
                type="email"
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input
                name="password"
                type="password"
                required
                minLength={8}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
            >
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>
        )}

        <div className="mt-4 relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-xs text-slate-400">
            <span className="bg-white px-2">or continue with</span>
          </div>
        </div>

        <button
          onClick={() => signIn('google', { callbackUrl: '/' })}
          className="mt-4 w-full flex items-center justify-center gap-2 border border-slate-300 hover:border-slate-400 bg-white py-2 rounded-lg text-sm font-medium text-slate-700 transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.909-2.259c-.806.54-1.837.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
            <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/sign-in/[[...sign-in]]/page.jsx"
git commit -m "feat: replace Clerk SignIn component with custom credentials + google sign-in form"
```

---

## Task 12: Update Environment Variables

**Files:**
- Modify: `.env.local`
- Modify: `.env.example` (if it exists)

- [ ] **Step 1: Update `.env.local`**

Remove the four Clerk lines and add the four NextAuth lines. The file should contain:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/gocart

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<generate: openssl rand -base64 32>
GOOGLE_CLIENT_ID=<from Google Cloud Console — APIs & Services → Credentials>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console — APIs & Services → Credentials>

# Cloudinary
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

To generate a secret immediately (paste the output into the file):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

- [ ] **Step 2: Update `.env.example`**

```bash
# Check if .env.example exists
ls .env.example
```

If it exists, apply the same swap: remove Clerk vars, add NextAuth vars with placeholder values.

- [ ] **Step 3: Commit `.env.example` only — never commit `.env.local`**

```bash
git add .env.example
git commit -m "chore: update env example — swap clerk vars for nextauth + google oauth vars"
```

---

## Task 13: Final Verification

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 2: Start the dev server**

```bash
npm run dev
```

Expected: server starts with no import errors. There may be warnings about missing Google OAuth credentials (normal until you add them).

- [ ] **Step 3: Verify sign-in page renders**

Open `http://localhost:3000/sign-in`. Expected: custom GoCart sign-in form with Sign In / Sign Up tabs and Google button.

- [ ] **Step 4: Register a test user**

Use the Sign Up tab: name `Test User`, email `test@gocart.dev`, password `password123`. Expected: account created and redirected to `/`.

- [ ] **Step 5: Sign in with credentials**

Sign out (if a UserMenu is visible), then sign in with `test@gocart.dev` / `password123`. Expected: redirected to `/`.

- [ ] **Step 6: Verify admin redirect protection**

While signed in as the test user (role: customer), navigate to `http://localhost:3000/admin`. Expected: redirected to `/`.

- [ ] **Step 7: Set admin role and test admin access**

In a separate terminal, run:

```bash
npx prisma studio
```

Find the test user in the `User` table, change `role` from `customer` to `admin`, save. Sign out and sign back in. Navigate to `http://localhost:3000/admin`. Expected: admin panel loads (or redirects to admin dashboard — not redirected away).

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "chore: nextauth migration complete — clerk fully removed"
```
