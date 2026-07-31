import { NextResponse } from 'next/server'
import { uploadImage } from '@/lib/cloudinary'
import { requireAdmin } from '@/lib/auth'

export async function POST(request) {
  const payload = requireAdmin(request)
  if (payload instanceof NextResponse) return payload

  try {
    const formData = await request.formData()
    const file = formData.get('image')

    if (!file) {
      return NextResponse.json({ error: 'No se envió ninguna imagen' }, { status: 400 })
    }

    const url = await uploadImage(file)
    return NextResponse.json({ url })
  } catch (error) {
    return NextResponse.json({ error: 'Error al subir la imagen' }, { status: 500 })
  }
}
