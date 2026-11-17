import { NextResponse } from 'next/server'
import { uploadImage } from '@/lib/cloudinary'
import { requireAdmin } from '@/lib/auth'
import { validateImageUpload } from '@/lib/upload-validation'

// Cuántos bytes iniciales se leen para reconocer el formato del archivo.
const SIGNATURE_BYTES = 16

export async function POST(request) {
  const payload = requireAdmin(request)
  if (payload instanceof NextResponse) return payload

  try {
    const formData = await request.formData()
    const file = formData.get('image')

    if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') {
      return NextResponse.json({ error: 'No se envió ninguna imagen' }, { status: 400 })
    }

    // Se valida el contenido real (tamaño y firma), no el Content-Type declarado.
    const head = new Uint8Array(await file.slice(0, SIGNATURE_BYTES).arrayBuffer())
    const check = validateImageUpload({ size: file.size, head })
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: check.status })
    }

    const url = await uploadImage(file)
    return NextResponse.json({ url })
  } catch (error) {
    return NextResponse.json({ error: 'Error al subir la imagen' }, { status: 500 })
  }
}
