'use client'

import { useState, useEffect } from 'react'
import AdminLayout from '@/components/admin/AdminLayout'
import LoadingModal from '@/components/ui/LoadingModal'
import {
  HiOutlineEnvelope,
  HiOutlineDevicePhoneMobile,
  HiOutlineChatBubbleLeftRight,
  HiOutlineLockClosed,
  HiOutlinePaperAirplane,
} from 'react-icons/hi2'
import { MESSAGE_DEFAULTS } from '@/lib/site-settings'

const MESSAGE_FIELDS = [
  {
    key: 'wa_consult',
    label: 'WhatsApp · Consulta de producto',
    hint: 'Mensaje inicial al consultar por un producto sin stock. Variables: {name}, {price}',
    rows: 4,
  },
  {
    key: 'wa_confirm',
    label: 'WhatsApp · Confirmación de compra',
    hint: 'Mensaje al confirmar la compra de un producto. Variables: {order_number}, {name}, {price}',
    rows: 4,
  },
  {
    key: 'wa_cart',
    label: 'WhatsApp · Confirmación del carrito',
    hint: 'Mensaje al confirmar el pedido desde el carrito. Variables: {order_number}, {items}, {subtotal}, {customer_name}, {customer_phone}',
    rows: 7,
  },
  {
    key: 'offer_label',
    label: 'Filtro de ofertas en el catálogo',
    hint: 'Texto del chip de filtro, ejemplo: "En oferta"',
    rows: 1,
  },
  {
    key: 'promo_badge',
    label: 'Badge de descuento simple',
    hint: 'Etiqueta en la tarjeta del producto. Variables: {pct}',
    rows: 1,
  },
  {
    key: 'promo_badge_qty',
    label: 'Badge de descuento por cantidad',
    hint: 'Etiqueta cuando el descuento aplica desde N unidades. Variables: {pct}, {min}',
    rows: 1,
  },
]

function Feedback({ status }) {
  if (!status) return null
  const ok = status.startsWith('✓')
  return (
    <div className={`text-sm ${ok ? 'text-emerald-400' : 'text-red-400'}`}>
      {status}
    </div>
  )
}

function SaveButton({ onClick, loading }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-dark text-white text-sm font-medium transition-all disabled:opacity-50"
    >
      <HiOutlinePaperAirplane size={15} />
      {loading ? 'Guardando...' : 'Guardar'}
    </button>
  )
}

function SectionCard({ icon: Icon, title, description, children }) {
  return (
    <div className="card-dark p-6 sm:p-8">
      <div className="flex items-start gap-4 mb-6">
        <div className="w-11 h-11 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
          <Icon className="text-primary-light" size={22} />
        </div>
        <div>
          <h2 className="font-display font-semibold text-white text-lg">{title}</h2>
          <p className="text-sm text-white/40 mt-0.5">{description}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

export default function AdminConfiguracion() {
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState(null)

  const [email, setEmail] = useState('')
  const [emailStatus, setEmailStatus] = useState('')
  const [emailSaving, setEmailSaving] = useState(false)
  const [testingEmail, setTestingEmail] = useState(false)

  const [whatsapp, setWhatsapp] = useState('')
  const [whatsappStatus, setWhatsappStatus] = useState('')
  const [whatsappSaving, setWhatsappSaving] = useState(false)

  const [messages, setMessages] = useState({ ...MESSAGE_DEFAULTS })
  const [messagesStatus, setMessagesStatus] = useState('')
  const [messagesSaving, setMessagesSaving] = useState(false)

  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' })
  const [passwordStatus, setPasswordStatus] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null

  useEffect(() => {
    fetch('/api/settings', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        if (!res.ok) throw new Error('No autorizado')
        return res.json()
      })
      .then(data => {
        setSettings(data)
        setEmail(data.notifications_email || '')
        setWhatsapp(data.whatsapp_number || '')
        setMessages({ ...MESSAGE_DEFAULTS, ...(data.messages || {}) })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const patch = async (body) => {
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Error al guardar')
    return data
  }

  const handleSaveEmail = async () => {
    setEmailSaving(true)
    setEmailStatus('')
    try {
      await patch({ notifications_email: email.trim() })
      setEmailStatus('✓ Email de notificaciones guardado')
    } catch (err) {
      setEmailStatus(err.message)
    } finally {
      setEmailSaving(false)
    }
  }

  const handleTestEmail = async () => {
    setTestingEmail(true)
    setEmailStatus('')
    try {
      const res = await fetch('/api/settings/test-email', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al enviar')
      setEmailStatus('✓ Email de prueba enviado')
    } catch (err) {
      setEmailStatus(err.message)
    } finally {
      setTestingEmail(false)
    }
  }

  const handleSaveWhatsapp = async () => {
    setWhatsappSaving(true)
    setWhatsappStatus('')
    try {
      await patch({ whatsapp_number: whatsapp.trim() })
      setWhatsappStatus('✓ Número de WhatsApp actualizado')
    } catch (err) {
      setWhatsappStatus(err.message)
    } finally {
      setWhatsappSaving(false)
    }
  }

  const handleSaveMessages = async () => {
    setMessagesSaving(true)
    setMessagesStatus('')
    try {
      await patch({ messages })
      setMessagesStatus('✓ Mensajes actualizados')
    } catch (err) {
      setMessagesStatus(err.message)
    } finally {
      setMessagesSaving(false)
    }
  }

  const handleSavePassword = async () => {
    setPasswordSaving(true)
    setPasswordStatus('')
    if (passwords.next !== passwords.confirm) {
      setPasswordStatus('Las contraseñas nuevas no coinciden')
      setPasswordSaving(false)
      return
    }
    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ current_password: passwords.current, new_password: passwords.next }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al cambiar la contraseña')
      setPasswords({ current: '', next: '', confirm: '' })
      setPasswordStatus('✓ Contraseña actualizada')
    } catch (err) {
      setPasswordStatus(err.message)
    } finally {
      setPasswordSaving(false)
    }
  }

  return (
    <AdminLayout title="Configuración">
      <LoadingModal open={loading || !settings} message="Cargando configuración..." />
      <div className="p-4 sm:p-8 lg:p-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SectionCard
            icon={HiOutlineEnvelope}
            title="Notificaciones por email"
            description="Casilla donde llegan los avisos de nuevos pedidos."
          >
            <div className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-widest text-white/40 mb-2">
                  Email de notificaciones
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="input-dark"
                  placeholder="hola@matematicos.com"
                />
              </div>
              <div className="flex items-center gap-3">
                <SaveButton onClick={handleSaveEmail} loading={emailSaving} />
                <button
                  onClick={handleTestEmail}
                  disabled={testingEmail || !email.trim()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 text-sm font-medium transition-all disabled:opacity-50"
                >
                  {testingEmail ? 'Enviando...' : 'Enviar email de prueba'}
                </button>
              </div>
              <Feedback status={emailStatus} />
            </div>
          </SectionCard>

          <SectionCard
            icon={HiOutlineDevicePhoneMobile}
            title="WhatsApp de contacto"
            description="Número usado en los botones de consulta y confirmación de pedidos."
          >
            <div className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-widest text-white/40 mb-2">
                  Número (con código de país, sin +)
                </label>
                <input
                  type="tel"
                  value={whatsapp}
                  onChange={e => setWhatsapp(e.target.value)}
                  className="input-dark"
                  placeholder="542657583046"
                />
              </div>
              <div className="flex items-center gap-3">
                <SaveButton onClick={handleSaveWhatsapp} loading={whatsappSaving} />
              </div>
              <Feedback status={whatsappStatus} />
            </div>
          </SectionCard>

          <SectionCard
            icon={HiOutlineChatBubbleLeftRight}
            title="Mensajes personalizados"
            description="Textos de WhatsApp, filtros y etiquetas del catálogo."
          >
            <div className="space-y-5">
              {MESSAGE_FIELDS.map(field => (
                <div key={field.key}>
                  <label className="block text-xs uppercase tracking-widest text-white/40 mb-2">
                    {field.label}
                  </label>
                  {field.rows > 1 ? (
                    <textarea
                      value={messages[field.key]}
                      onChange={e => setMessages(prev => ({ ...prev, [field.key]: e.target.value }))}
                      rows={field.rows}
                      className="input-dark resize-y"
                    />
                  ) : (
                    <input
                      type="text"
                      value={messages[field.key]}
                      onChange={e => setMessages(prev => ({ ...prev, [field.key]: e.target.value }))}
                      className="input-dark"
                    />
                  )}
                  <p className="text-[11px] text-white/30 mt-1.5">{field.hint}</p>
                </div>
              ))}
              <div className="flex items-center gap-3">
                <SaveButton onClick={handleSaveMessages} loading={messagesSaving} />
              </div>
              <Feedback status={messagesStatus} />
            </div>
          </SectionCard>

          <SectionCard
            icon={HiOutlineLockClosed}
            title="Seguridad"
            description="Cambio de contraseña del panel de administración."
          >
            <div className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-widest text-white/40 mb-2">
                  Contraseña actual
                </label>
                <input
                  type="password"
                  value={passwords.current}
                  onChange={e => setPasswords(prev => ({ ...prev, current: e.target.value }))}
                  className="input-dark"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-white/40 mb-2">
                  Contraseña nueva (mínimo 6 caracteres)
                </label>
                <input
                  type="password"
                  value={passwords.next}
                  onChange={e => setPasswords(prev => ({ ...prev, next: e.target.value }))}
                  className="input-dark"
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-white/40 mb-2">
                  Repetir contraseña nueva
                </label>
                <input
                  type="password"
                  value={passwords.confirm}
                  onChange={e => setPasswords(prev => ({ ...prev, confirm: e.target.value }))}
                  className="input-dark"
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </div>
              <div className="flex items-center gap-3">
                <SaveButton onClick={handleSavePassword} loading={passwordSaving} />
              </div>
              <Feedback status={passwordStatus} />
            </div>
          </SectionCard>
        </div>
      </div>
    </AdminLayout>
  )
}
