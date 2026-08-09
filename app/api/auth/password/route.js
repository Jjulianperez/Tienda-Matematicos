import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/auth'

export async function POST(request) {
  const payload = requireAdmin(request)
  if (payload instanceof NextResponse) return payload

  const { current_password, new_password } = await request.json()

  if (!current_password || !new_password) {
    return NextResponse.json({ error: 'Completá todos los campos' }, { status: 400 })
  }
  if (new_password.length < 6) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
  }

  const { data: admin, error: adminError } = await supabaseAdmin
    .from('admins')
    .select('*')
    .eq('id', payload.id)
    .single()

  if (adminError || !admin) {
    return NextResponse.json({ error: 'No se encontró el admin' }, { status: 401 })
  }

  const valid = await bcrypt.compare(current_password, admin.password_hash)
  if (!valid) {
    return NextResponse.json({ error: 'La contraseña actual es incorrecta' }, { status: 400 })
  }

  const password_hash = await bcrypt.hash(new_password, 10)

  const { error } = await supabaseAdmin
    .from('admins')
    .update({ password_hash })
    .eq('id', admin.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
