'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'
import { Users, Plus, X, Check, Shield } from 'lucide-react'

interface User { id: string; full_name: string; email: string; role: string; is_active: boolean; created_at: string }

const ROLES = [
  { key: 'tenant_admin', label: 'Administrador', color: 'text-red-400 bg-red-400/10' },
  { key: 'manager',      label: 'Gerente',        color: 'text-purple-400 bg-purple-400/10' },
  { key: 'cashier',      label: 'Cajero',          color: 'text-blue-400 bg-blue-400/10' },
  { key: 'waiter',       label: 'Mesero',          color: 'text-green-400 bg-green-400/10' },
  { key: 'kitchen',      label: 'Cocinero',        color: 'text-orange-400 bg-orange-400/10' },
]

export default function UsersPage() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role: 'cashier' })

  const { data: users } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => { const { data } = await api.get('/auth/users'); return data.data },
  })

  const createUser = useMutation({
    mutationFn: () => api.post('/auth/users', form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('Usuario creado')
      setShowModal(false)
      setForm({ full_name: '', email: '', password: '', role: 'cashier' })
    },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error'),
  })

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.patch(`/auth/users/${id}`, { is_active: active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })

  function getRoleCfg(role: string) {
    return ROLES.find(r => r.key === role) ?? { label: role, color: 'text-gray-400 bg-gray-400/10' }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center gap-3">
        <Users className="text-orange-400" size={20} />
        <h1 className="text-lg font-bold text-white">Gestión de Usuarios</h1>
        <button onClick={() => setShowModal(true)}
          className="ml-auto bg-orange-500 hover:bg-orange-600 text-white text-sm px-3 py-1.5 rounded-lg flex items-center gap-1 transition">
          <Plus size={14} /> Nuevo usuario
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {users?.map(user => {
          const roleCfg = getRoleCfg(user.role)
          return (
            <div key={user.id} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-center gap-4">
              <div className="w-9 h-9 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                <Shield size={16} className="text-orange-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-sm">{user.full_name}</p>
                <p className="text-xs text-gray-500">{user.email}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleCfg.color}`}>{roleCfg.label}</span>
              <button
                onClick={() => toggleActive.mutate({ id: user.id, active: !user.is_active })}
                className={`text-xs px-3 py-1 rounded-lg transition ${user.is_active ? 'bg-green-900/30 text-green-400 hover:bg-red-900/30 hover:text-red-400' : 'bg-red-900/30 text-red-400 hover:bg-green-900/30 hover:text-green-400'}`}
              >
                {user.is_active ? 'Activo' : 'Inactivo'}
              </button>
            </div>
          )
        })}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h2 className="font-bold text-white">Nuevo usuario</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-4 space-y-3">
              {[
                { key: 'full_name', label: 'Nombre completo', placeholder: 'Juan García' },
                { key: 'email', label: 'Correo electrónico', placeholder: 'juan@restaurante.com' },
                { key: 'password', label: 'Contraseña', placeholder: 'Mínimo 6 caracteres' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="text-xs text-gray-400 mb-1 block">{label}</label>
                  <input
                    type={key === 'password' ? 'password' : 'text'}
                    value={form[key as keyof typeof form]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
                  />
                </div>
              ))}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Rol</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500">
                  {ROLES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                </select>
              </div>
              <button onClick={() => createUser.mutate()}
                disabled={!form.full_name || !form.email || !form.password || createUser.isPending}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 transition">
                <Check size={15} /> {createUser.isPending ? 'Creando...' : 'Crear usuario'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
