# GoCart — Auth.js v5 Migration Design Spec

**Date:** 2026-06-11  
**Status:** Approved  
**Scope:** Replace Clerk with Auth.js v5 (next-auth@beta) + Prisma adapter across the entire GoCart platform

---

## 1. Overview

Replace `@clerk/nextjs` with Auth.js v5 (`next-auth@beta`) using the Prisma adapter. Supports both Google OAuth and email/password credentials. Roles (admin, vendor, customer) move from Clerk `publicMetadata` to a `role` column on the `User` table. JWT session strategy is used throughout.

**Why Auth.js v5:** Best Next.js 15 App Router compatibility, `auth()` works in server components and API routes directly, middleware is a thin wrapper. JWT strategy chosen because Credentials provider is incompatible with database sessions.

---

## 2. Dependencies

**Remove:**
- `@clerk/nextjs`

**Add:**
- `next-auth@beta`
- `@auth/prisma-adapter`
- `bcryptjs`
- `@types/bcryptjs` (dev)

---

## 3. Prisma Schema Changes

### Modified: `User` model

```prisma
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  image         String?
  password      String?
  role          String    @default("customer")
  cart          Json      @default("{}")

  // Relations
  accounts    Account[]
  ratings     Rating[]
  Address     Address[]
  store       Store?
  buyerOrders Order[]   @relation("BuyerRelation")
}
```

**Changes from current:**
- `id` — add `@default(cuid())` (Clerk previously provided the ID)
- `name` — make nullable (`String?`) since OAuth users may not provide one initially
- `email` — add `@unique` constraint (required by adapter)
- `image` — make nullable (`String?`)
- `emailVerified DateTime?` — new, required by adapter
- `password String?` — new, nullable (OAuth users have no password)
- `role String @default("customer")` — new, replaces Clerk `publicMetadata.role`
- `accounts Account[]` — new relation

### New: NextAuth adapter models

```prisma
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
```

Note: `Session` model is required by the adapter schema but is not used at runtime (JWT strategy stores sessions in cookies, not DB).

---

## 4. Auth Configuration

### `auth.ts` (project root)

Central export for all Auth.js functionality.

```
auth.ts
├── PrismaAdapter(prisma)         — handles Account/VerificationToken DB writes
├── session: { strategy: 'jwt' } — roles and userId in signed JWT cookie
├── Google provider               — GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
├── Credentials provider          — email + bcrypt password lookup
├── JWT callback                  — stamps role + id onto token at sign-in
└── Session callback              — exposes session.user.role + session.user.id
```

Exports: `{ handlers, auth, signIn, signOut }`

### `app/api/auth/[...nextauth]/route.ts`

```ts
import { handlers } from '@/auth'
export const { GET, POST } = handlers
```

---

## 5. Middleware (`middleware.js`)

Wraps Auth.js `auth` to inject `req.auth` (decoded JWT). No external API call on each request.

| Route pattern | Rule | Redirect on failure |
|---|---|---|
| `/admin/*`, `/api/admin/*` | authenticated + `role === 'admin'` | `/` |
| `/store/*`, `/api/store/*` | authenticated + `role === 'vendor'` | `/` |
| `/orders` | authenticated (any role) | `/sign-in` |
| All other routes | public | — |

Matcher config is unchanged from current Clerk middleware.

---

## 6. Auth Helpers (`lib/auth.js`)

Same three functions, same signatures — internal implementation only changes. All future API route call sites are unaffected.

```js
import { auth } from '@/auth'

export async function requireAdmin()  // returns { userId, role } or null
export async function requireVendor() // returns { userId, role } or null
export async function getAuthUser()   // returns { userId, role } (nulls if unauthenticated)
```

---

## 7. UI Changes

### `app/AuthProvider.jsx` (new)

Client component wrapping `SessionProvider` from `next-auth/react`. Inserted into `app/layout.jsx` in place of `ClerkProvider`. Root layout remains a server component.

### `app/layout.jsx`

`ClerkProvider` → `AuthProvider`. No other changes.

### Sign-in page (`app/sign-in/[[...sign-in]]/page.jsx`)

Clerk `<SignIn />` replaced with a custom client form with two tabs:

| Tab | Action |
|---|---|
| Sign In | Email + password → `signIn('credentials', { email, password, redirectTo: '/' })` |
| Sign Up | Name + email + password → `POST /api/auth/register`, then `signIn('credentials', ...)` |

Google button on both tabs: `signIn('google')`. Post-sign-in redirect is role-aware: admin → `/admin`, vendor → `/store`, customer → `/`.

### `POST /api/auth/register` (new route)

Handles credential-based registration. Clerk handled this automatically; we own it now.

1. Validate `{ name, email, password }` — 400 if missing or email already exists
2. Hash password with `bcrypt.hash(password, 12)`
3. `prisma.user.create({ data: { name, email, password: hash, role: 'customer' } })`
4. Return `{ success: true }`

### `<UserButton />` replacement

Clerk's `<UserButton />` in `AdminNavbar` and `StoreNavbar` replaced with a custom client dropdown component (`components/admin/ui/UserMenu.jsx`) showing:
- User avatar (image or initials fallback)
- User name + email
- Sign Out button → `signOut({ callbackUrl: '/sign-in' })`

Reused by both admin and vendor navbars.

---

## 8. Role Assignment

### Customer
`role: "customer"` is the Prisma schema default. Set automatically on user creation — no action needed.

### Vendor
Set by the `POST /api/public/stores` route (Phase 4) at store creation time:
```js
await prisma.user.update({ where: { id: userId }, data: { role: 'vendor' } })
```
Role change takes effect on next sign-in (JWT trade-off). The create-store page calls `signOut({ callbackUrl: '/sign-in' })` after store creation to force re-authentication.

### Admin
Set directly in the database:
```sql
UPDATE "User" SET role = 'admin' WHERE email = 'admin@example.com';
```
User signs out and back in for the role to reflect in their JWT.

**JWT trade-off:** Role changes only take effect on next sign-in. Acceptable for this platform — admin role changes are infrequent, and vendor role change is handled by the forced sign-out flow.

---

## 9. Environment Variables

**Remove:**
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
NEXT_PUBLIC_CLERK_SIGN_IN_URL
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL
```

**Add:**
```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<random-32-char-string>
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
```

---

## 10. Files Changed / Created

| File | Action |
|---|---|
| `prisma/schema.prisma` | Modify User model + add Account, Session, VerificationToken |
| `auth.ts` | Create — NextAuth config |
| `app/api/auth/[...nextauth]/route.ts` | Create — handler export |
| `app/api/auth/register/route.js` | Create — registration endpoint |
| `middleware.js` | Replace — Clerk → Auth.js |
| `lib/auth.js` | Replace — Clerk helpers → NextAuth helpers |
| `app/layout.jsx` | Modify — ClerkProvider → AuthProvider |
| `app/AuthProvider.jsx` | Create — SessionProvider wrapper |
| `app/sign-in/[[...sign-in]]/page.jsx` | Replace — Clerk SignIn → custom form |
| `components/admin/ui/UserMenu.jsx` | Create — UserButton replacement |
| `components/admin/AdminNavbar.jsx` | Modify — use UserMenu |
| `components/store/StoreNavbar.jsx` | Modify — use UserMenu |
| `.env.local` / `.env.example` | Modify — swap Clerk vars for NextAuth vars |

---

## 11. Out of Scope

- Email verification flow (VerificationToken exists in schema but verification emails not configured)
- Forgot password / password reset
- Session invalidation from admin panel
- Any changes to Phases 2–5 feature scope
