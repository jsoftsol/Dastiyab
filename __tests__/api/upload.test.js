import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  requireVendor: vi.fn(),
  requireAdmin: vi.fn(),
}))

vi.mock('@/lib/cloudinary', () => ({
  default: {
    uploader: { upload: vi.fn() },
  },
}))

import { requireVendor, requireAdmin } from '@/lib/auth'
import cloudinary from '@/lib/cloudinary'
import { POST } from '@/app/api/upload/route'

const mockFile = {
  arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
  type: 'image/jpeg',
}

const makeRequest = (file = null) => ({
  formData: () => Promise.resolve({ get: (key) => (key === 'file' ? file : null) }),
})

beforeEach(() => vi.clearAllMocks())

describe('POST /api/upload', () => {
  it('returns 401 when neither vendor nor admin', async () => {
    requireVendor.mockResolvedValue(null)
    requireAdmin.mockResolvedValue(null)
    const res = await POST(makeRequest(mockFile))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 400 when no file is provided', async () => {
    requireVendor.mockResolvedValue({ userId: 'u1', role: 'vendor' })
    requireAdmin.mockResolvedValue(null)
    const res = await POST(makeRequest(null))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('No file provided')
  })

  it('uploads file to cloudinary and returns url', async () => {
    requireVendor.mockResolvedValue({ userId: 'u1', role: 'vendor' })
    requireAdmin.mockResolvedValue(null)
    cloudinary.uploader.upload.mockResolvedValue({ secure_url: 'https://res.cloudinary.com/test/image.jpg' })
    const res = await POST(makeRequest(mockFile))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.url).toBe('https://res.cloudinary.com/test/image.jpg')
  })
})
