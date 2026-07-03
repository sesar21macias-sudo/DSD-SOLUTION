'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'
import { Users, Plus, X, Check, Shield } from 'lucide-react'

interface User { id: string; full_name: string; email: string; role: string; is_active: boolean; created_at: string }

const ROLES = [
  { key: 'tenant_admin', label: 'Administrador', fg: '#7c3aed', bg: '#f5f3ff' },
  { key: 'manager',      label: 'Gerente',        fg: '#0e7490', bg: '#ecfeff' },
  { key: 'cashier',      label: 'Cajero',          fg: '#1d4ed8', bg: '#eff6ff' },
  { key: 'waiter',       label: 'Mesero',          fg: '#15803d', bg: '#f0fdf4' },
  { key: 'kitchen',      label: 'Cocinero',        fg: '#c2410c', bg: '#fff7ed' },
]

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#f9fafb', border: '1px solid #e5e7eb',
  borderRadius: '10px', padding: '9px 13px', fontSize: '14px',
  color: '#111827', outline: 'none',
}

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
      toast.success('Usuario creado'); setShowModal(false)
      setForm({ full_name: '', email: '', password: '', role: 'cashier' })
    },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error'),
  })

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => api.patch(`/auth/users/${id}`, { is_active: active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })

  function getRoleCfg(role: string) {
    return ROLES.find(r => r.key === role) ?? { label: role, fg: '#6b7280', bg: '#f0f2f5' }
  }

  return (
    <div className="h-full flex flex-col" style={{ background: '#f5f6fa' }}>
      {/* Header */}
      <div className="px-6 py-4 flex items-center gap-3" style={{ background: '#ffffff', borderBottom: '1px solid #e5e7eb' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#f0f2f5' }}>
          <Users size={17} style={{ color: '#374151' }} />
        </div>
        <h1 className="text-base font-bold" style={{ color: '#111827' }}>Gestión de Usuarios</h1>
        <button onClick={() => setShowModal(true)}
          className="ml-auto text-sm px-3 py-1.5 rounded-lg flex items-center gap-1 font-semibold text-white transition"
          style={{ background: '#111827' }}>
          <Plus size={13}/> Nuevo usuario
        </button>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {users?.map(user => {
          const roleCfg = getRoleCfg(user.role)
          return (
            <div key={user.id} className="flex items-center gap-4 px-4 py-3 rounded-xl"
              style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: '#f0f2f5' }}>
                <Shield size={16} style={{ color: '#6b7280' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm" style={{ color: '#111827' }}>{user.full_name}</p>
                <p className="text-xs" style={{ color: '#9ca3af' }}>{user.email}</p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                style={{ background: roleCfg.bg, color: roleCfg.fg }}>
                {roleCfg.label}
              </span>
              <button onClick={() => toggleActive.mutate({ id: user.id, active: !user.is_active })}
                className="text-xs px-3 py-1.5 rounded-lg font-medium transition"
                style={user.is_active
                  ? { background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }
                  : { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                {user.is_active ? 'Activo' : 'Inactivo'}
              </button>
            </div>
          )
        })}
        {(!users || users.length === 0) && (
          <div className="text-center py-12" style={{ color: '#d1d5db' }}>
            <Users size={36} className="mx-auto mb-2 opacity-30"/>
            <p className="text-sm">Sin usuarios registrados</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{ background: '#ffffff', border: '1px solid #e5e7eb', boxShadow: '0 20px 40px rgba(0,0,0,0.12)' }}>
            <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid #f0f2f5' }}>
              <h2 className="font-bold" style={{ color: '#111827' }}>Nuevo usuario</h2>
              <button onClick={() => setShowModal(false)} className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ color: '#9ca3af', background: '#f9fafb' }}><X size={15}/></button>
            </div>
            <div className="p-4 space-y-3">
              {[
                { key: 'full_name', label: 'Nombre completo',    placeholder: 'Juan García',               type: 'text' },
                { key: 'email',     label: 'Correo electrónico', placeholder: 'juan@restaurante.com',       type: 'email' },
                { key: 'password',  label: 'Contraseña',         placeholder: 'Mínimo 6 caracteres',       type: 'password' },
              ].map(({ key, label, placeholder, type }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#6b7280' }}>{label}</label>
                  <input type={type} value={form[key as keyof typeof form]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder} style={inputStyle}
                    onFocus={e => (e.currentTarget.style.borderColor = '#111827')}
                    onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')} />
                </div>
              ))}
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#6b7280' }}>Rol</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#111827')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')}>
                  {ROLES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                </select>
              </div>
              <button onClick={() => createUser.mutate()}
                disabled={!form.full_name || !form.email || !form.password || createUser.isPending}
                className="w-full text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-40"
                style={{ background: '#111827' }}>
                <Check size={15}/> {createUser.isPending ? 'Creando...' : 'Crear usuario'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
