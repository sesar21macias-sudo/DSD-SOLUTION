'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'
import { CalendarClock, Plus, X, Users, Phone, Check, UserCheck, Ban } from 'lucide-react'

interface Reservation {
  id: string; customer_name: string; customer_phone: string | null; party_size: number
  reservation_time: string; status: string; notes: string | null
  table_id: string | null; tables: { number: number; name: string } | null
}
interface Table { id: string; number: number; name: string }

const STATUS_CFG: Record<string, { label: string; fg: string; bg: string }> = {
  confirmed: { label: 'Confirmada', fg: '#1d4ed8', bg: '#eff6ff' },
  seated:    { label: 'Sentados',   fg: '#15803d', bg: '#f0fdf4' },
  completed: { label: 'Completada', fg: '#6b7280', bg: '#f0f2f5' },
  cancelled: { label: 'Cancelada',  fg: '#dc2626', bg: '#fef2f2' },
  no_show:   { label: 'No llegó',   fg: '#b45309', bg: '#fffbeb' },
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#f9fafb', border: '1px solid #e5e7eb',
  borderRadius: '10px', padding: '9px 13px', fontSize: '14px',
  color: '#111827', outline: 'none',
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

export default function ReservationsPage() {
  const qc = useQueryClient()
  const [date, setDate] = useState(todayStr())
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ customer_name: '', customer_phone: '', party_size: 2, time: '', table_id: '', notes: '' })

  const { data: reservations } = useQuery<Reservation[]>({
    queryKey: ['reservations', date],
    queryFn: async () => { const { data } = await api.get('/reservations', { params: { date } }); return data.data },
  })
  const { data: tables } = useQuery<Table[]>({
    queryKey: ['tables'],
    queryFn: async () => { const { data } = await api.get('/menu/tables'); return data.data },
  })

  const create = useMutation({
    mutationFn: () => {
      const iso = new Date(`${date}T${form.time}:00`).toISOString()
      return api.post('/reservations', {
        customer_name: form.customer_name,
        customer_phone: form.customer_phone || undefined,
        party_size: form.party_size,
        reservation_time: iso,
        table_id: form.table_id || undefined,
        notes: form.notes || undefined,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservations'] })
      toast.success('Reservación creada'); setShowModal(false)
      setForm({ customer_name: '', customer_phone: '', party_size: 2, time: '', table_id: '', notes: '' })
    },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error al crear'),
  })

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/reservations/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reservations'] }),
  })

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: '#f5f6fa' }}>
      <div className="px-6 py-4 flex items-center gap-3" style={{ background: '#ffffff', borderBottom: '1px solid #e5e7eb' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#f0f2f5' }}>
          <CalendarClock size={17} style={{ color: '#374151' }} />
        </div>
        <h1 className="text-base font-bold" style={{ color: '#111827' }}>Reservaciones</h1>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          style={{ ...inputStyle, width: 'auto', marginLeft: 16 }} />
        <button onClick={() => setShowModal(true)}
          className="ml-auto text-sm px-3 py-1.5 rounded-lg flex items-center gap-1 font-semibold text-white transition"
          style={{ background: '#111827' }}>
          <Plus size={13}/> Nueva reservación
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {reservations?.map(r => {
          const cfg = STATUS_CFG[r.status] ?? STATUS_CFG['confirmed']
          const time = new Date(r.reservation_time).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
          return (
            <div key={r.id} className="flex items-center gap-4 px-4 py-3 rounded-xl"
              style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}>
              <div className="text-center flex-shrink-0" style={{ width: 56 }}>
                <p className="font-bold text-sm" style={{ color: '#111827' }}>{time}</p>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm" style={{ color: '#111827' }}>{r.customer_name}</p>
                <div className="flex items-center gap-3 text-xs mt-0.5" style={{ color: '#9ca3af' }}>
                  <span className="flex items-center gap-1"><Users size={11}/>{r.party_size}</span>
                  {r.customer_phone && <span className="flex items-center gap-1"><Phone size={11}/>{r.customer_phone}</span>}
                  {r.tables && <span>Mesa {r.tables.number}</span>}
                </div>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0" style={{ background: cfg.bg, color: cfg.fg }}>
                {cfg.label}
              </span>
              {r.status === 'confirmed' && (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => setStatus.mutate({ id: r.id, status: 'seated' })}
                    title="Marcar sentados" className="w-8 h-8 rounded-lg flex items-center justify-center transition"
                    style={{ background: '#f0fdf4', color: '#15803d' }}>
                    <UserCheck size={14}/>
                  </button>
                  <button onClick={() => setStatus.mutate({ id: r.id, status: 'no_show' })}
                    title="No llegó" className="w-8 h-8 rounded-lg flex items-center justify-center transition"
                    style={{ background: '#fffbeb', color: '#b45309' }}>
                    <Ban size={14}/>
                  </button>
                  <button onClick={() => setStatus.mutate({ id: r.id, status: 'cancelled' })}
                    title="Cancelar" className="w-8 h-8 rounded-lg flex items-center justify-center transition"
                    style={{ background: '#fef2f2', color: '#dc2626' }}>
                    <X size={14}/>
                  </button>
                </div>
              )}
            </div>
          )
        })}
        {(!reservations || reservations.length === 0) && (
          <div className="text-center py-16" style={{ color: '#d1d5db' }}>
            <CalendarClock size={36} className="mx-auto mb-2 opacity-30"/>
            <p className="text-sm">Sin reservaciones para este día</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{ background: '#ffffff', border: '1px solid #e5e7eb', boxShadow: '0 20px 40px rgba(0,0,0,0.12)' }}>
            <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid #f0f2f5' }}>
              <h2 className="font-bold" style={{ color: '#111827' }}>Nueva reservación · {date}</h2>
              <button onClick={() => setShowModal(false)} className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ color: '#9ca3af', background: '#f9fafb' }}><X size={15}/></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#6b7280' }}>Nombre del cliente</label>
                <input value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
                  placeholder="María López" style={inputStyle} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#6b7280' }}>Hora</label>
                  <input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#6b7280' }}>Personas</label>
                  <input type="number" min={1} value={form.party_size}
                    onChange={e => setForm(f => ({ ...f, party_size: parseInt(e.target.value) || 1 }))} style={inputStyle} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#6b7280' }}>Teléfono (opcional)</label>
                <input value={form.customer_phone} onChange={e => setForm(f => ({ ...f, customer_phone: e.target.value }))}
                  placeholder="55..." style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#6b7280' }}>Mesa (opcional)</label>
                <select value={form.table_id} onChange={e => setForm(f => ({ ...f, table_id: e.target.value }))} style={inputStyle}>
                  <option value="">Sin asignar</option>
                  {tables?.map(t => <option key={t.id} value={t.id}>Mesa {t.number} — {t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#6b7280' }}>Notas (opcional)</label>
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Alergia a mariscos, mesa junto a ventana..." style={inputStyle} />
              </div>
              <button onClick={() => create.mutate()}
                disabled={!form.customer_name || !form.time || create.isPending}
                className="w-full text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-40"
                style={{ background: '#111827' }}>
                <Check size={15}/> {create.isPending ? 'Creando...' : 'Crear reservación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
