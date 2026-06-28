'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'
import { Timer, DollarSign, Lock, Unlock, AlertTriangle } from 'lucide-react'

interface Shift {
  id: string
  opening_amount: number
  opened_at: string
  users: { full_name: string }
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['current-shift'] }); toast.success('Turno abierto'); setOpeningAmount(''); setNotes('') },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error'),
  })

  const closeShift = useMutation({
    mutationFn: () => api.post('/shift/close', { closing_amount: parseFloat(closingAmount), notes }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['current-shift'] })
      const d = res.data.data
      const diff = d.difference ?? 0
      if (Math.abs(diff) < 0.01) toast.success('Turno cerrado. Caja exacta ✓')
      else if (diff > 0) toast(`Turno cerrado. Sobrante: $${diff.toFixed(2)}`, { icon: '📈' })
      else toast(`Turno cerrado. Faltante: $${Math.abs(diff).toFixed(2)}`, { icon: '⚠️' })
      setClosingAmount(''); setNotes('')
    },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error'),
  })

  const elapsed = shift ? Math.floor((Date.now() - new Date(shift.opened_at).getTime()) / 60000) : 0
  const hours = Math.floor(elapsed / 60)
  const mins = elapsed % 60

  return (
    <div className="h-full flex flex-col">
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center gap-3">
        <Timer className="text-orange-400" size={20} />
        <h1 className="text-lg font-bold text-white">Turno / Corte de Caja</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex items-start justify-center">
        <div className="w-full max-w-md space-y-4">
          {isLoading ? (
            <div className="text-center text-gray-500 py-12">Cargando...</div>
          ) : !shift ? (
            /* Abrir turno */
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-3 text-green-400 mb-2">
                <Unlock size={20} />
                <h2 className="font-bold text-white">Abrir turno</h2>
              </div>
              <p className="text-sm text-gray-400">No hay turno activo. Introduce el fondo inicial de caja.</p>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Fondo inicial en caja ($)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input type="number" value={openingAmount} onChange={e => setOpeningAmount(e.target.value)}
                    placeholder="0.00" className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-7 pr-4 py-3 text-white text-lg focus:outline-none focus:border-orange-500" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Notas (opcional)</label>
                <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observaciones del turno..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-orange-500" />
              </div>
              <button onClick={() => openShift.mutate()} disabled={openShift.isPending}
                className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2">
                <Unlock size={16} /> Abrir turno
              </button>
            </div>
          ) : (
            /* Cerrar turno */
            <div className="space-y-4">
              {/* Turno activo info */}
              <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4">
                <div className="flex items-center gap-2 text-green-400 mb-2">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="font-bold text-sm">Turno activo</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-400 text-xs">Abierto por</p>
                    <p className="text-white font-medium">{shift.users?.full_name}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">Tiempo activo</p>
                    <p className="text-white font-medium">{hours}h {mins}m</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">Fondo inicial</p>
                    <p className="text-orange-400 font-bold">${Number(shift.opening_amount).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">Apertura</p>
                    <p className="text-white font-medium">{new Date(shift.opened_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              </div>

              {/* Cerrar turno */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-2 text-red-400">
                  <Lock size={18} />
                  <h2 className="font-bold text-white">Corte de caja</h2>
                </div>
                <div className="flex items-start gap-2 bg-yellow-900/20 border border-yellow-700/30 rounded-xl p-3">
                  <AlertTriangle size={14} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-yellow-300">Cuenta el efectivo en caja y anota el total exacto. El sistema calculará si hay sobrante o faltante.</p>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Efectivo contado en caja ($)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                    <input type="number" value={closingAmount} onChange={e => setClosingAmount(e.target.value)}
                      placeholder="0.00" className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-7 pr-4 py-3 text-white text-xl font-bold focus:outline-none focus:border-orange-500" autoFocus />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Notas del cierre</label>
                  <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observaciones..."
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-orange-500" />
                </div>
                <button onClick={() => closeShift.mutate()} disabled={!closingAmount || closeShift.isPending}
                  className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2">
                  <Lock size={16} /> Cerrar turno
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
