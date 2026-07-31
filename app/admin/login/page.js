'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import GeometricDecor from '@/components/ui/GeometricDecor'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Error al iniciar sesión')
      }

      localStorage.setItem('token', data.token)
      router.push('/admin/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-carbon flex items-center justify-center px-4 relative overflow-hidden">
      <GeometricDecor variant="blueprint" className="absolute inset-0 w-full h-full opacity-40" />
      <div className="absolute inset-0 bg-gradient-to-b from-carbon/70 via-transparent to-carbon" />

      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-6 group">
            <div className="w-11 h-11 rounded-xl overflow-hidden shadow-lg shadow-primary/25 group-hover:shadow-primary/40 transition-shadow">
              <Image
                src="/assets/brand/favicon.png"
                alt="MateMáticos"
                width={44}
                height={44}
                className="w-full h-full object-cover"
              />
            </div>
          </Link>
          <h1 className="font-display text-3xl font-bold text-white">
            Panel <span className="text-primary-light">Admin</span>
          </h1>
          <p className="text-sm text-white/40 mt-2">Acceso restringido · verificación de identidad</p>
        </div>

        <form onSubmit={handleSubmit} className="card-dark p-8 space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs uppercase tracking-widest text-white/40 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-dark"
              placeholder="admin@matematicos.com"
              required
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-white/40 mb-2">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-dark"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-primary hover:bg-primary-dark text-white font-medium transition-all disabled:opacity-50"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <div className="text-center mt-6">
          <span className="badge badge-geo">Sistema seguro</span>
        </div>
      </div>
    </div>
  )
}
