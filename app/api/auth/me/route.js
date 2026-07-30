import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'

export async function GET(request) {
  const payload = requireAdmin(request)
  if (payload instanceof NextResponse) return payload

  return NextResponse.json({ admin: payload })
}
