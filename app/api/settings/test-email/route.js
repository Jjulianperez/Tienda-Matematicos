import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { sendTestEmail } from '@/lib/email'

export async function POST(request) {
  const payload = requireAdmin(request)
  if (payload instanceof NextResponse) return payload

  try {
    await sendTestEmail()
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
