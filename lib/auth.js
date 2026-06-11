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
