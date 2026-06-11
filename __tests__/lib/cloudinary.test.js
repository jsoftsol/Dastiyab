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
