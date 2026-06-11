import { NextResponse } from 'next/server'
import cloudinary from '@/lib/cloudinary'
import { requireVendor } from '@/lib/auth'
import { requireAdmin } from '@/lib/auth'

export async function POST(request) {
  const vendor = await requireVendor()
  const admin = await requireAdmin()
  if (!vendor && !admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file')
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const dataURI = `data:${file.type};base64,${buffer.toString('base64')}`

  try {
    const result = await cloudinary.uploader.upload(dataURI, { folder: 'gocart' })
    return NextResponse.json({ url: result.secure_url })
  } catch {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
