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
