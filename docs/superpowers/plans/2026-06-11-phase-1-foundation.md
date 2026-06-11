# Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up Clerk authentication, PostgreSQL + Prisma, Cloudinary config, and route protection middleware — giving every subsequent phase a real auth/DB/storage foundation to build on.

**Architecture:** Clerk handles auth with role-based access (`admin`, `vendor`, `customer`) enforced in `middleware.js`. A single shared Prisma client in `lib/prisma.js` connects to a local Docker PostgreSQL instance. A Cloudinary helper in `lib/cloudinary.js` provides a configured client for image uploads. Auth helper functions in `lib/auth.js` are used by all API routes to verify roles server-side.

**Tech Stack:** Next.js 15.3.5, Clerk (`@clerk/nextjs` v6+), Prisma 6, PostgreSQL 16 (Docker), Cloudinary SDK v2, Vitest, `@vitejs/plugin-react`

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `docker-compose.yml` | Local PostgreSQL container |
| Create | `.env.local` | All secret/local env vars (gitignored) |
| Modify | `.env.example` | Document all required vars |
| Modify | `prisma/schema.prisma` | Remove driverAdapters + directUrl |
| Create | `lib/prisma.js` | Shared Prisma client singleton |
| Create | `lib/auth.js` | `requireAdmin`, `requireVendor`, `getAuthUser` helpers |
| Create | `lib/cloudinary.js` | Configured Cloudinary v2 client |
| Create | `vitest.config.mjs` | Vitest config with `@` alias |
| Modify | `package.json` | Add all new dependencies + test script |
| Modify | `app/layout.jsx` | Wrap with `ClerkProvider` |
| Create | `app/sign-in/[[...sign-in]]/page.jsx` | Clerk hosted sign-in UI |
| Create | `middleware.js` | Clerk middleware — protects `/admin/*`, `/store/*`, `/api/admin/*`, `/api/store/*` |
| Create | `__tests__/lib/auth.test.js` | Unit tests for auth helpers (mocked Clerk) |
| Create | `__tests__/lib/prisma.test.js` | Integration test — DB connection |

---

## Prerequisites

- Docker Desktop installed and running
- A Clerk account — create a project at https://clerk.com (free tier is fine)
- A Cloudinary account — sign up at https://cloudinary.com (free tier is fine)

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime dependencies**

```bash
npm install @clerk/nextjs cloudinary
```

- [ ] **Step 2: Install dev dependencies**

```bash
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 3: Verify package.json has all new packages**

Check `package.json` — `dependencies` should include `@clerk/nextjs` and `cloudinary`. `devDependencies` should include `vitest`, `@vitejs/plugin-react`, `@testing-library/react`, `@testing-library/jest-dom`.

---

## Task 2: Set Up Docker PostgreSQL

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.local`

- [ ] **Step 1: Create docker-compose.yml**

```yaml
services:
  postgres:
    image: postgres:16
    container_name: gocart_db
    environment:
      POSTGRES_USER: gocart
      POSTGRES_PASSWORD: gocart
      POSTGRES_DB: gocart
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

- [ ] **Step 2: Create .env.local with all environment variables**

```env
# Currency
NEXT_PUBLIC_CURRENCY_SYMBOL=$

# Database
DATABASE_URL=postgresql://gocart:gocart@localhost:5432/gocart

# Clerk — get these from your Clerk project dashboard > API Keys
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_REPLACE_ME
CLERK_SECRET_KEY=sk_test_REPLACE_ME
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/

# Cloudinary — get these from your Cloudinary dashboard
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=REPLACE_ME
CLOUDINARY_API_KEY=REPLACE_ME
CLOUDINARY_API_SECRET=REPLACE_ME
```

- [ ] **Step 3: Verify .env.local is gitignored**

Open `.gitignore`. Confirm `.env.local` is listed. If not, add it:

```
.env.local
```

- [ ] **Step 4: Start the PostgreSQL container**

```bash
docker compose up -d
```

Expected output:
```
✔ Container gocart_db  Started
```

- [ ] **Step 5: Verify the container is running**

```bash
docker ps
```

Expected: a row showing `gocart_db` with status `Up`.

---

## Task 3: Configure Prisma for Standard PostgreSQL

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Update the generator and datasource blocks**

Replace the existing `generator` and `datasource` blocks at the top of `prisma/schema.prisma` with:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Leave all model definitions unchanged.

- [ ] **Step 2: Generate the Prisma client**

```bash
npx prisma generate
```

Expected output includes: `Generated Prisma Client`.

- [ ] **Step 3: Push the schema to the database**

```bash
npx prisma db push
```

Expected output includes: `Your database is now in sync with your Prisma schema`.

- [ ] **Step 4: Verify tables were created**

```bash
npx prisma studio
```

A browser window opens at `http://localhost:5555`. Confirm the following models are visible: User, Product, Order, OrderItem, Rating, Address, Coupon, Store. Close Prisma Studio.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma docker-compose.yml .env.example
git commit -m "feat: configure prisma for standard postgresql, add docker compose"
```

---

## Task 4: Set Up Vitest

**Files:**
- Create: `vitest.config.mjs`
- Modify: `package.json`

- [ ] **Step 1: Create vitest.config.mjs**

```javascript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
```

- [ ] **Step 2: Add test script to package.json**

In `package.json`, add to the `scripts` block:

```json
"test": "vitest",
"test:run": "vitest run"
```

- [ ] **Step 3: Write a smoke test to verify Vitest works**

Create `__tests__/smoke.test.js`:

```javascript
import { describe, it, expect } from 'vitest'

describe('vitest setup', () => {
  it('runs tests', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 4: Run the smoke test**

```bash
npm run test:run
```

Expected output:
```
✓ __tests__/smoke.test.js (1)
  ✓ vitest setup > runs tests

Test Files  1 passed (1)
Tests  1 passed (1)
```

- [ ] **Step 5: Commit**

```bash
git add vitest.config.mjs package.json __tests__/smoke.test.js
git commit -m "feat: add vitest with path alias support"
```

---

## Task 5: Create Prisma Client Singleton + Integration Test

**Files:**
- Create: `lib/prisma.js`
- Create: `__tests__/lib/prisma.test.js`

- [ ] **Step 1: Write the failing integration test**

Create `__tests__/lib/prisma.test.js`:

```javascript
import { describe, it, expect, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'

describe('Prisma client', () => {
  it('connects to the database and executes a query', async () => {
    const result = await prisma.$queryRaw`SELECT 1 AS connected`
    expect(Number(result[0].connected)).toBe(1)
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })
})
```

- [ ] **Step 2: Run the test — expect it to fail**

```bash
npm run test:run -- __tests__/lib/prisma.test.js
```

Expected: FAIL — `Cannot find module '@/lib/prisma'`

- [ ] **Step 3: Create lib/prisma.js**

```javascript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

- [ ] **Step 4: Run the test — expect it to pass**

```bash
npm run test:run -- __tests__/lib/prisma.test.js
```

Expected:
```
✓ __tests__/lib/prisma.test.js (1)
  ✓ Prisma client > connects to the database and executes a query
```

- [ ] **Step 5: Commit**

```bash
git add lib/prisma.js __tests__/lib/prisma.test.js
git commit -m "feat: add shared prisma client singleton"
```

---

## Task 6: Create Auth Helpers + Unit Tests

**Files:**
- Create: `lib/auth.js`
- Create: `__tests__/lib/auth.test.js`

- [ ] **Step 1: Write the failing unit tests**

Create `__tests__/lib/auth.test.js`:

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}))

import { auth } from '@clerk/nextjs/server'
import { requireAdmin, requireVendor, getAuthUser } from '@/lib/auth'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('requireAdmin', () => {
  it('returns null when unauthenticated', async () => {
    auth.mockResolvedValue({ userId: null, sessionClaims: null })
    expect(await requireAdmin()).toBeNull()
  })

  it('returns null when user has vendor role', async () => {
    auth.mockResolvedValue({
      userId: 'user_123',
      sessionClaims: { metadata: { role: 'vendor' } },
    })
    expect(await requireAdmin()).toBeNull()
  })

  it('returns session data when user has admin role', async () => {
    auth.mockResolvedValue({
      userId: 'user_123',
      sessionClaims: { metadata: { role: 'admin' } },
    })
    const result = await requireAdmin()
    expect(result).toEqual({
      userId: 'user_123',
      sessionClaims: { metadata: { role: 'admin' } },
    })
  })
})

describe('requireVendor', () => {
  it('returns null when unauthenticated', async () => {
    auth.mockResolvedValue({ userId: null, sessionClaims: null })
    expect(await requireVendor()).toBeNull()
  })

  it('returns null when user has admin role', async () => {
    auth.mockResolvedValue({
      userId: 'user_123',
      sessionClaims: { metadata: { role: 'admin' } },
    })
    expect(await requireVendor()).toBeNull()
  })

  it('returns session data when user has vendor role', async () => {
    auth.mockResolvedValue({
      userId: 'user_123',
      sessionClaims: { metadata: { role: 'vendor' } },
    })
    const result = await requireVendor()
    expect(result).toEqual({
      userId: 'user_123',
      sessionClaims: { metadata: { role: 'vendor' } },
    })
  })
})

describe('getAuthUser', () => {
  it('returns null userId and null role when unauthenticated', async () => {
    auth.mockResolvedValue({ userId: null, sessionClaims: null })
    const result = await getAuthUser()
    expect(result).toEqual({ userId: null, role: null })
  })

  it('returns userId and role when authenticated', async () => {
    auth.mockResolvedValue({
      userId: 'user_456',
      sessionClaims: { metadata: { role: 'customer' } },
    })
    const result = await getAuthUser()
    expect(result).toEqual({ userId: 'user_456', role: 'customer' })
  })
})
```

- [ ] **Step 2: Run tests — expect them to fail**

```bash
npm run test:run -- __tests__/lib/auth.test.js
```

Expected: FAIL — `Cannot find module '@/lib/auth'`

- [ ] **Step 3: Create lib/auth.js**

```javascript
import { auth } from '@clerk/nextjs/server'

export async function requireAdmin() {
  const { userId, sessionClaims } = await auth()
  if (!userId || sessionClaims?.metadata?.role !== 'admin') return null
  return { userId, sessionClaims }
}

export async function requireVendor() {
  const { userId, sessionClaims } = await auth()
  if (!userId || sessionClaims?.metadata?.role !== 'vendor') return null
  return { userId, sessionClaims }
}

export async function getAuthUser() {
  const { userId, sessionClaims } = await auth()
  return {
    userId: userId ?? null,
    role: sessionClaims?.metadata?.role ?? null,
  }
}
```

- [ ] **Step 4: Run tests — expect them to pass**

```bash
npm run test:run -- __tests__/lib/auth.test.js
```

Expected:
```
✓ __tests__/lib/auth.test.js (8)
  ✓ requireAdmin > returns null when unauthenticated
  ✓ requireAdmin > returns null when user has vendor role
  ✓ requireAdmin > returns session data when user has admin role
  ✓ requireVendor > returns null when unauthenticated
  ✓ requireVendor > returns null when user has admin role
  ✓ requireVendor > returns session data when user has vendor role
  ✓ getAuthUser > returns null userId and null role when unauthenticated
  ✓ getAuthUser > returns userId and role when authenticated
```

- [ ] **Step 5: Commit**

```bash
git add lib/auth.js __tests__/lib/auth.test.js
git commit -m "feat: add clerk auth helpers with role checking"
```

---

## Task 7: Configure Cloudinary Helper

**Files:**
- Create: `lib/cloudinary.js`
- Create: `__tests__/lib/cloudinary.test.js`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/cloudinary.test.js`:

```javascript
import { describe, it, expect } from 'vitest'

process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = 'test_cloud'
process.env.CLOUDINARY_API_KEY = 'test_key'
process.env.CLOUDINARY_API_SECRET = 'test_secret'

describe('cloudinary config', () => {
  it('exports a configured cloudinary instance', async () => {
    const { default: cloudinary } = await import('@/lib/cloudinary')
    const config = cloudinary.config()
    expect(config.cloud_name).toBe('test_cloud')
    expect(config.api_key).toBe('test_key')
    expect(config.api_secret).toBe('test_secret')
  })
})
```

- [ ] **Step 2: Run test — expect it to fail**

```bash
npm run test:run -- __tests__/lib/cloudinary.test.js
```

Expected: FAIL — `Cannot find module '@/lib/cloudinary'`

- [ ] **Step 3: Create lib/cloudinary.js**

```javascript
import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export default cloudinary
```

- [ ] **Step 4: Run test — expect it to pass**

```bash
npm run test:run -- __tests__/lib/cloudinary.test.js
```

Expected:
```
✓ __tests__/lib/cloudinary.test.js (1)
  ✓ cloudinary config > exports a configured cloudinary instance
```

- [ ] **Step 5: Commit**

```bash
git add lib/cloudinary.js __tests__/lib/cloudinary.test.js
git commit -m "feat: add cloudinary helper"
```

---

## Task 8: Configure Clerk in the App

**Files:**
- Modify: `app/layout.jsx`
- Create: `app/sign-in/[[...sign-in]]/page.jsx`

> **Before starting:** Fill in real Clerk keys in `.env.local`. Get them from your Clerk dashboard at https://clerk.com → Your Project → API Keys.

- [ ] **Step 1: Wrap app/layout.jsx with ClerkProvider**

Replace the entire contents of `app/layout.jsx` with:

```jsx
import { ClerkProvider } from '@clerk/nextjs'
import { Outfit } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import StoreProvider from '@/app/StoreProvider'
import './globals.css'

const outfit = Outfit({ subsets: ['latin'], weight: ['400', '500', '600'] })

export const metadata = {
  title: 'GoCart. - Shop smarter',
  description: 'GoCart. - Shop smarter',
}

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${outfit.className} antialiased`}>
          <StoreProvider>
            <Toaster />
            {children}
          </StoreProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
```

- [ ] **Step 2: Create the sign-in page**

Create `app/sign-in/[[...sign-in]]/page.jsx`:

```jsx
import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <SignIn />
    </div>
  )
}
```

- [ ] **Step 3: Start the dev server and verify sign-in page loads**

```bash
npm run dev
```

Open `http://localhost:3000/sign-in`. You should see the Clerk sign-in widget. Sign in with a test account. After sign-in you should be redirected to `/` (the storefront home).

- [ ] **Step 4: Commit**

```bash
git add app/layout.jsx app/sign-in
git commit -m "feat: integrate clerk provider and sign-in page"
```

---

## Task 9: Create Route Protection Middleware

**Files:**
- Create: `middleware.js`

- [ ] **Step 1: Create middleware.js at the repo root**

```javascript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isAdminRoute = createRouteMatcher(['/admin(.*)', '/api/admin(.*)'])
const isVendorRoute = createRouteMatcher(['/store(.*)', '/api/store(.*)'])
const isProtectedRoute = createRouteMatcher([
  '/admin(.*)',
  '/store(.*)',
  '/api/admin(.*)',
  '/api/store(.*)',
  '/orders',
])

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect()
  }

  const { sessionClaims } = await auth()
  const role = sessionClaims?.metadata?.role

  if (isAdminRoute(req) && role !== 'admin') {
    return NextResponse.redirect(new URL('/', req.url))
  }

  if (isVendorRoute(req) && role !== 'vendor') {
    return NextResponse.redirect(new URL('/', req.url))
  }
})

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
}
```

- [ ] **Step 2: Verify admin route is protected (unauthenticated)**

With the dev server running (`npm run dev`), open an incognito window and navigate to `http://localhost:3000/admin`. You should be redirected to `/sign-in`.

- [ ] **Step 3: Verify admin route is protected (wrong role)**

Sign in as a regular user (customer, no role set). Navigate to `http://localhost:3000/admin`. You should be redirected to `/` (homepage).

- [ ] **Step 4: Set admin role in Clerk dashboard**

1. Go to your Clerk dashboard → Users → select your account
2. Scroll to **Metadata** → **Public metadata**
3. Set: `{ "role": "admin" }`
4. Navigate to `http://localhost:3000/admin` — you should reach the admin dashboard (it still shows dummy data, that's expected)

- [ ] **Step 5: Commit**

```bash
git add middleware.js
git commit -m "feat: add clerk middleware with admin and vendor route protection"
```

---

## Task 10: Update .env.example and Run Full Test Suite

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Update .env.example to document all required variables**

Replace the contents of `.env.example` with:

```env
# Currency
NEXT_PUBLIC_CURRENCY_SYMBOL=$

# Database (PostgreSQL)
DATABASE_URL=postgresql://user:password@localhost:5432/gocart

# Clerk (get from https://clerk.com → Your Project → API Keys)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/

# Cloudinary (get from https://cloudinary.com → Dashboard)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

- [ ] **Step 2: Run the full test suite**

```bash
npm run test:run
```

Expected:
```
✓ __tests__/smoke.test.js (1)
✓ __tests__/lib/auth.test.js (8)
✓ __tests__/lib/cloudinary.test.js (1)
✓ __tests__/lib/prisma.test.js (1)

Test Files  4 passed (4)
Tests  11 passed (11)
```

- [ ] **Step 3: Final commit**

```bash
git add .env.example
git commit -m "chore: update env.example with all phase 1 variables"
```

---

## Phase 1 Complete ✓

At the end of Phase 1 you have:
- PostgreSQL running locally in Docker with all schema tables created
- Prisma client singleton in `lib/prisma.js` shared across all future API routes
- Clerk auth configured — sign-in page at `/sign-in`, ClerkProvider wrapping the app
- Role-based middleware protecting `/admin/*` and `/store/*`
- Auth helpers in `lib/auth.js` ready for use in all API route handlers
- Cloudinary helper in `lib/cloudinary.js` ready for Phase 5 uploads
- 11 passing tests

**Next:** Phase 2 — Admin Panel (TailAdmin UI + 6 admin pages + API routes)
See: `docs/superpowers/plans/2026-06-11-phase-2-admin-panel.md` (created when Phase 2 begins)
