'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', { email, password })
      setAuth(data.data.user, data.data.token)
      toast.success(`Bienvenido, ${data.data.user.fullName}`)
      router.push('/pos')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error al iniciar sesión'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-orange-500 mb-4">
            <span className="text-2xl font-black text-white">DSD</span>
          </div>
          <h1 className="text-2xl font-bold text-white">DSD POS</h1>
          <p className="text-gray-400 text-sm mt-1">Sistema de Punto de Venta</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-gray-900 rounded-2xl p-6 border border-gray-800 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@restaurante.com"
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition"
          >
            {loading ? 'Entrando...' : 'Iniciar sesión'}
          </button>
        </form>

        <p className="text-center text-gray-600 text-xs mt-6">DSD AI Solutions © 2024</p>
      </div>
    </div>
  )
}
