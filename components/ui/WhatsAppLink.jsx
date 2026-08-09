'use client'

import { useSiteSettings } from '@/hooks/useSiteSettings'

export default function WhatsAppLink({ message = '', className = '', children, ...rest }) {
  const { whatsapp_number } = useSiteSettings()

  const href = `https://wa.me/${whatsapp_number}${message ? `?text=${encodeURIComponent(message)}` : ''}`

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className} {...rest}>
      {children}
    </a>
  )
}
