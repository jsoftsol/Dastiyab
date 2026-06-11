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
