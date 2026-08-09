import { NextResponse } from 'next/server'
import { getSettings } from '@/lib/settings'

export async function GET() {
  const settings = await getSettings()

  return NextResponse.json({
    whatsapp_number: settings.whatsapp_number,
    messages: settings.messages,
  })
}
