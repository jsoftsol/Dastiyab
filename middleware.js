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
