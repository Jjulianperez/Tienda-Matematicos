'use client'

import Link from 'next/link'
import { HiOutlineLockClosed, HiOutlineHome } from 'react-icons/hi2'

export default function AdminBlockedScreen() {
  return (
    <div className="min-h-screen bg-carbon flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
          <HiOutlineLockClosed className="w-8 h-8 text-red-400" />
        </div>

        <h1 className="font-display text-2xl font-bold text-white mb-3">
          Panel de administración bloqueado
        </h1>

        <p className="text-white/50 leading-relaxed mb-8">
          El acceso al panel se encuentra temporalmente suspendido. Por favor, comunicate con el administrador del servicio para regularizar el acceso.
        </p>

        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary hover:bg-primary-dark text-white text-sm font-medium transition-all"
        >
          <HiOutlineHome size={18} />
          Volver a la tienda
        </Link>
      </div>
    </div>
  )
}
