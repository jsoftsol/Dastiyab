import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../prisma/generated/prisma/client.ts'

const globalForPrisma = globalThis

const createClient = () => {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma
