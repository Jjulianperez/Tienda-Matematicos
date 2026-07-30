import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'
import { signToken } from '@/lib/auth'

export async function POST(request) {
  try {
    const { email, password } = await request.json()

    const { data: admin } = await supabaseAdmin
      .from('admins')
      .select('*')
      .eq('email', email)
      .single()

    if (!admin) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, admin.password_hash)
    if (!valid) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 })
    }

    const token = signToken({ id: admin.id, email: admin.email })

    return NextResponse.json({ token })
  } catch (error) {
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
