'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'
import { Timer, Lock, Unlock, AlertTriangle, Clock, DollarSign } from 'lucide-react'

interface Shift {
  id: string; opening_amount: number; opened_at: string
  users: { full_name: string }
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#f9fafb', border: '1px solid #e5e7eb',
  borderRadius: '12px', padding: '11px 44px 11px 40px', fontSize: '18px',
  fontWeight: 700, color: '#111827', outline: 'none',
}

export default function ShiftPage() {
  const qc = useQueryClient()
  const [openingAmount, setOpeningAmount] = useState('')
  const [closingAmount, setClosingAmount] = useState('')
  const [notes, setNotes] = useState('')

  const { data: shift, isLoading } = useQuery<Shift | null>({
    queryKey: ['current-shift'],
    queryFn: async () => { const { data } = await api.get('/shift/current'); return data.data },
  })

  const openShift = useMutation({
    mutationFn: () => api.post('/shift/open', { opening_amount: parseFloat(openingAmount) || 0, notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['current-shift'] })
      toast.success('Turno abierto'); setOpeningAmount(''); setNotes('')
    },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error'),
  })

  const closeShift = useMutation({
    mutationFn: () => api.post('/shift/close', { closing_amount: parseFloat(closingAmount), notes }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['current-shift'] })
      const d = res.data.data; const diff = d.difference ?? 0
      if (Math.abs(diff) < 0.01) toast.success('Turno cerrado. Caja exacta ✓')
      else if (diff > 0) toast(`Sobrante: $${diff.toFixed(2)}`, { icon: '📈' })
      else toast(`Faltante: $${Math.abs(diff).toFixed(2)}`, { icon: '⚠️' })
      setClosingAmount(''); setNotes('')
    },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error'),
  })

  const elapsed = shift ? Math.floor((Date.now() - new Date(shift.opened_at).getTime()) / 60000) : 0
  const hours = Math.floor(elapsed / 60)
  const mins  = elapsed % 60

  const fieldStyle: React.CSSProperties = {
    width: '100%', background: '#f9fafb', border: '1px solid #e5e7eb',
    borderRadius: '10px', padding: '9px 13px', fontSize: '14px',
    color: '#111827', outline: 'none',
  }

  return (
    <div className="h-full flex flex-col" style={{ background: '#f5f6fa' }}>
      {/* Header */}
      <div className="px-6 py-4 flex items-center gap-3" style={{ background: '#ffffff', borderBottom: '1px solid #e5e7eb' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#f0f2f5' }}>
          <Timer size={17} style={{ color: '#374151' }} />
        </div>
        <h1 className="text-base font-bold" style={{ color: '#111827' }}>Turno / Corte de Caja</h1>
        {shift && (
          <span className="ml-auto flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full"
            style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"/>
            Turno activo
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex items-start justify-center">
        <div className="w-full max-w-md space-y-4">
          {isLoading ? (
            <div className="text-center py-12 text-sm" style={{ color: '#9ca3af' }}>Cargando...</div>
          ) : !shift ? (
            /* Abrir turno */
            <div className="rounded-2xl p-6 space-y-4" style={{ background: '#ffffff', border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#f0fdf4' }}>
                  <Unlock size={18} style={{ color: '#15803d' }} />
                </div>
                <div>
                  <h2 className="font-bold" style={{ color: '#111827' }}>Abrir turno</h2>
                  <p className="text-xs" style={{ color: '#9ca3af' }}>No hay turno activo. Ingresa el fondo inicial.</p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6b7280' }}>Fondo inicial en caja ($)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-lg" style={{ color: '#9ca3af' }}>$</span>
                  <input type="number" value={openingAmount} onChange={e => setOpeningAmount(e.target.value)}
                    placeholder="0.00" style={inputStyle}
                    onFocus={e => (e.currentTarget.style.borderColor = '#111827')}
                    onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#6b7280' }}>Notas (opcional)</label>
                <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observaciones del turno..."
                  style={fieldStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#111827')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')} />
              </div>
              <button onClick={() => openShift.mutate()} disabled={openShift.isPending}
                className="w-full text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-40"
                style={{ background: '#16a34a' }}>
                <Unlock size={16}/> {openShift.isPending ? 'Abriendo...' : 'Abrir turno'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Info turno activo */}
              <div className="rounded-2xl p-4" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-start gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center mt-0.5" style={{ background: '#dcfce7' }}>
                      <Clock size={14} style={{ color: '#15803d' }} />
                    </div>
                    <div>
                      <p className="text-xs" style={{ color: '#6b7280' }}>Tiempo activo</p>
                      <p className="font-black text-lg" style={{ color: '#111827' }}>{hours}h {mins}m</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center mt-0.5" style={{ background: '#dcfce7' }}>
                      <DollarSign size={14} style={{ color: '#15803d' }} />
                    </div>
                    <div>
                      <p className="text-xs" style={{ color: '#6b7280' }}>Fondo inicial</p>
                      <p className="font-black text-lg" style={{ color: '#111827' }}>${Number(shift.opening_amount).toFixed(2)}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: '#6b7280' }}>Abierto por</p>
                    <p className="font-semibold text-sm" style={{ color: '#111827' }}>{shift.users?.full_name}</p>
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: '#6b7280' }}>Apertura</p>
                    <p className="font-semibold text-sm" style={{ color: '#111827' }}>
                      {new Date(shift.opened_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Cerrar turno */}
              <div className="rounded-2xl p-6 space-y-4" style={{ background: '#ffffff', border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#fef2f2' }}>
                    <Lock size={18} style={{ color: '#dc2626' }} />
                  </div>
                  <div>
                    <h2 className="font-bold" style={{ color: '#111827' }}>Corte de caja</h2>
                    <p className="text-xs" style={{ color: '#9ca3af' }}>Cuenta el efectivo y registra el total.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 rounded-xl p-3" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
                  <AlertTriangle size={14} style={{ color: '#d97706', marginTop: 1 }} />
                  <p className="text-xs" style={{ color: '#92400e' }}>Cuenta el efectivo en caja y anota el total exacto. El sistema calculará si hay sobrante o faltante.</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6b7280' }}>Efectivo contado en caja ($)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-lg" style={{ color: '#9ca3af' }}>$</span>
                    <input type="number" value={closingAmount} onChange={e => setClosingAmount(e.target.value)}
                      placeholder="0.00" autoFocus style={inputStyle}
                      onFocus={e => (e.currentTarget.style.borderColor = '#111827')}
                      onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#6b7280' }}>Notas del cierre</label>
                  <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observaciones..."
                    style={fieldStyle}
                    onFocus={e => (e.currentTarget.style.borderColor = '#111827')}
                    onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')} />
                </div>
                <button onClick={() => closeShift.mutate()} disabled={!closingAmount || closeShift.isPending}
                  className="w-full text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-40"
                  style={{ background: '#dc2626' }}>
                  <Lock size={16}/> {closeShift.isPending ? 'Cerrando...' : 'Cerrar turno'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
