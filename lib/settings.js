import { supabaseAdmin } from '@/lib/supabase'
import { MESSAGE_DEFAULTS } from '@/lib/site-settings'

const ENV_DEFAULTS = {
  notifications_email: process.env.RESEND_TO_EMAIL || '',
  whatsapp_number: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '',
}

export async function getSettings() {
  const { data, error } = await supabaseAdmin
    .from('settings')
    .select('key, value')

  if (error || !data) {
    return {
      notifications_email: ENV_DEFAULTS.notifications_email,
      whatsapp_number: ENV_DEFAULTS.whatsapp_number,
      messages: { ...MESSAGE_DEFAULTS },
    }
  }

  const stored = {}
  for (const row of data) stored[row.key] = row.value

  return {
    notifications_email: stored.notifications_email || ENV_DEFAULTS.notifications_email,
    whatsapp_number: stored.whatsapp_number || ENV_DEFAULTS.whatsapp_number,
    messages: { ...MESSAGE_DEFAULTS, ...(stored.messages || {}) },
  }
}

export async function saveSettings(updates) {
  for (const [key, value] of Object.entries(updates)) {
    const { error } = await supabaseAdmin
      .from('settings')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    if (error) throw new Error(error.message)
  }
}
