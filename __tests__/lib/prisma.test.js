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
