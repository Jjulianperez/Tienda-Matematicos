import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getSettings, saveSettings } from '@/lib/settings'
import { MESSAGE_DEFAULTS } from '@/lib/site-settings'

const ALLOWED_KEYS = ['notifications_email', 'whatsapp_number', 'messages']

export async function GET(request) {
  const payload = requireAdmin(request)
  if (payload instanceof NextResponse) return payload

  return NextResponse.json(await getSettings())
}

export async function PATCH(request) {
  const payload = requireAdmin(request)
  if (payload instanceof NextResponse) return payload

  const body = await request.json()
  const updates = {}

  for (const key of ALLOWED_KEYS) {
    if (body[key] !== undefined) updates[key] = body[key]
  }

  if (updates.messages && typeof updates.messages === 'object' && !Array.isArray(updates.messages)) {
    const clean = {}
    for (const [key, value] of Object.entries(updates.messages)) {
      if (key in MESSAGE_DEFAULTS && typeof value === 'string') clean[key] = value
    }
    if (Object.keys(clean).length === 0) delete updates.messages
    else updates.messages = clean
  } else if (updates.messages) {
    delete updates.messages
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Sin cambios para guardar' }, { status: 400 })
  }

  try {
    await saveSettings(updates)
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, settings: await getSettings() })
}
