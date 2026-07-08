'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'
import { Truck, Copy, RefreshCw, Check, AlertCircle } from 'lucide-react'

interface Integration { id: string; provider: string; is_active: boolean; webhook_secret: string }
interface Settings { integration: Integration | null; webhook_url: string | null }

const PROVIDERS = [
  { key: 'chowly',     label: 'Chowly' },
  { key: 'otter',      label: 'Otter' },
  { key: 'deliverect', label: 'Deliverect' },
  { key: 'other',      label: 'Otro / genérico' },
]

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#f9fafb', border: '1px solid #e5e7eb',
  borderRadius: '10px', padding: '10px 13px', fontSize: '13px',
  color: '#111827', outline: 'none', fontFamily: 'monospace',
}

export default function IntegrationsPage() {
  const qc = useQueryClient()
  const [provider, setProvider] = useState<'chowly' | 'otter' | 'deliverect' | 'other'>('other')
  const [showSecret, setShowSecret] = useState(false)

  const { data } = useQuery<Settings>({
    queryKey: ['delivery-settings'],
    queryFn: async () => { const { data } = await api.get('/delivery/settings'); return data.data },
  })

  const save = useMutation({
    mutationFn: (isActive: boolean) => api.post('/delivery/settings', { provider, is_active: isActive }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['delivery-settings'] }); toast.success('Configuración guardada') },
    onError: () => toast.error('Error al guardar'),
  })

  const regenerate = useMutation({
    mutationFn: () => api.post('/delivery/settings/regenerate-secret'),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['delivery-settings'] }); toast.success('Secreto regenerado') },
    onError: () => toast.error('No hay integración configurada todavía — actívala primero'),
  })

  function copy(text: string) {
    navigator.clipboard.writeText(text)
    toast.success('Copiado')
  }

  const integration = data?.integration

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: '#f5f6fa' }}>
      <div className="px-6 py-4 flex items-center gap-3" style={{ background: '#ffffff', borderBottom: '1px solid #e5e7eb' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#f0f2f5' }}>
          <Truck size={17} style={{ color: '#374151' }} />
        </div>
        <h1 className="text-base font-bold" style={{ color: '#111827' }}>Integración de Delivery</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-xl space-y-4">
          <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
            <AlertCircle size={16} style={{ color: '#b45309', flexShrink: 0, marginTop: 2 }} />
            <p className="text-xs" style={{ color: '#92400e' }}>
              Uber Eats y DoorDash no dan API directa a restaurantes individuales — se conectan a través de un
              agregador como Chowly, Otter o Deliverect. Configura aquí el webhook que ese agregador va a llamar
              cuando llegue un pedido nuevo; el pedido aparecerá automáticamente en Cocina y Mesas.
            </p>
          </div>

          <div className="rounded-2xl p-5 space-y-4" style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}>
            <div>
              <label className="block text-xs font-semibold mb-2" style={{ color: '#6b7280' }}>Proveedor / agregador</label>
              <div className="grid grid-cols-2 gap-2">
                {PROVIDERS.map(p => (
                  <button key={p.key} onClick={() => setProvider(p.key as typeof provider)}
                    className="py-2.5 rounded-xl text-xs font-semibold transition"
                    style={provider === p.key
                      ? { background: '#111827', color: '#ffffff', border: '1px solid #111827' }
                      : { background: '#f9fafb', color: '#6b7280', border: '1px solid #e5e7eb' }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {integration ? (
              <>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6b7280' }}>URL del webhook (configúrala en tu agregador)</label>
                  <div className="flex gap-2">
                    <input readOnly value={data?.webhook_url ?? ''} style={inputStyle} />
                    <button onClick={() => copy(data?.webhook_url ?? '')}
                      className="px-3 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: '#f0f2f5', color: '#374151' }}>
                      <Copy size={14}/>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6b7280' }}>
                    Header requerido: <code>X-Webhook-Secret</code>
                  </label>
                  <div className="flex gap-2">
                    <input readOnly type={showSecret ? 'text' : 'password'} value={integration.webhook_secret} style={inputStyle} />
                    <button onClick={() => setShowSecret(s => !s)}
                      className="px-3 rounded-xl text-xs font-semibold flex-shrink-0" style={{ background: '#f0f2f5', color: '#374151' }}>
                      {showSecret ? 'Ocultar' : 'Ver'}
                    </button>
                    <button onClick={() => copy(integration.webhook_secret)}
                      className="px-3 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: '#f0f2f5', color: '#374151' }}>
                      <Copy size={14}/>
                    </button>
                  </div>
                  <button onClick={() => regenerate.mutate()} disabled={regenerate.isPending}
                    className="text-xs mt-2 flex items-center gap-1.5 font-semibold" style={{ color: '#dc2626' }}>
                    <RefreshCw size={11}/> Regenerar secreto
                  </button>
                </div>
                <div className="flex items-center justify-between rounded-xl px-3 py-2.5" style={{ background: '#f9fafb', border: '1px solid #f0f2f5' }}>
                  <span className="text-xs font-semibold" style={{ color: '#6b7280' }}>Integración activa</span>
                  <button onClick={() => save.mutate(!integration.is_active)}
                    className="px-3 py-1 rounded-lg text-xs font-semibold transition"
                    style={integration.is_active
                      ? { background: '#111827', color: '#ffffff' }
                      : { background: '#e5e7eb', color: '#6b7280' }}>
                    {integration.is_active ? 'Activada' : 'Desactivada'}
                  </button>
                </div>
              </>
            ) : (
              <button onClick={() => save.mutate(true)} disabled={save.isPending}
                className="w-full text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-40"
                style={{ background: '#111827' }}>
                <Check size={15}/> {save.isPending ? 'Activando...' : 'Activar integración'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
