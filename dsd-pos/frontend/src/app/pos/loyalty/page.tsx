'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import toast from 'react-hot-toast'
import { Search, Star, Gift, Plus, X, Trash2, Award, Phone, TrendingUp } from 'lucide-react'

interface LoyaltyTransaction { id: string; points_earned: number; points_redeemed: number; description: string; created_at: string }
interface Customer {
  id: string; phone: string; full_name: string | null; points: number
  total_visits: number; total_spent: number; tier: string
  loyalty_transactions?: LoyaltyTransaction[]
}
interface Reward { id: string; name: string; description: string | null; points_required: number; reward_type: string; is_active: boolean }

const TIER_CFG: Record<string, { label: string; fg: string; bg: string }> = {
  bronze:   { label: 'Bronce',  fg: '#92400e', bg: '#fef3c7' },
  silver:   { label: 'Plata',   fg: '#475569', bg: '#f1f5f9' },
  gold:     { label: 'Oro',     fg: '#a16207', bg: '#fef9c3' },
  platinum: { label: 'Platino', fg: '#6d28d9', bg: '#f5f3ff' },
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#f9fafb', border: '1px solid #e5e7eb',
  borderRadius: '10px', padding: '9px 13px', fontSize: '14px',
  color: '#111827', outline: 'none',
}

export default function LoyaltyPage() {
  const qc = useQueryClient()
  const user = useAuthStore(s => s.user)
  const canManage = user?.role === 'tenant_admin' || user?.role === 'manager'

  const [search, setSearch] = useState('')
  const [activePhone, setActivePhone] = useState<string | null>(null)
  const [showRewardModal, setShowRewardModal] = useState(false)
  const [rewardForm, setRewardForm] = useState({ name: '', points_required: '', reward_type: 'discount' })

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ['loyalty-customers', search],
    queryFn: async () => { const { data } = await api.get('/loyalty/customers', { params: search ? { search } : {} }); return data.data },
  })

  const { data: activeCustomer } = useQuery<Customer>({
    queryKey: ['loyalty-customer', activePhone],
    queryFn: async () => { const { data } = await api.get(`/loyalty/customers/${activePhone}`); return data.data },
    enabled: !!activePhone,
  })

  const { data: rewards } = useQuery<Reward[]>({
    queryKey: ['loyalty-rewards'],
    queryFn: async () => { const { data } = await api.get('/loyalty/rewards'); return data.data },
  })

  const createReward = useMutation({
    mutationFn: () => api.post('/loyalty/rewards', {
      name: rewardForm.name,
      points_required: parseInt(rewardForm.points_required, 10),
      reward_type: rewardForm.reward_type,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loyalty-rewards'] })
      toast.success('Recompensa creada'); setShowRewardModal(false)
      setRewardForm({ name: '', points_required: '', reward_type: 'discount' })
    },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error'),
  })

  const deleteReward = useMutation({
    mutationFn: (id: string) => api.delete(`/loyalty/rewards/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['loyalty-rewards'] }); toast.success('Recompensa eliminada') },
  })

  const redeem = useMutation({
    mutationFn: (rewardId: string) => api.post('/loyalty/redeem', { phone: activePhone, reward_id: rewardId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loyalty-customer', activePhone] })
      qc.invalidateQueries({ queryKey: ['loyalty-customers'] })
      toast.success('Recompensa canjeada')
    },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'No se pudo canjear'),
  })

  const tierCfg = activeCustomer ? (TIER_CFG[activeCustomer.tier] ?? TIER_CFG['bronze']) : null

  return (
    <div className="h-full flex" style={{ background: '#f5f6fa' }}>
      {/* Lista de clientes */}
      <div className="w-80 flex flex-col flex-shrink-0" style={{ background: '#ffffff', borderRight: '1px solid #e5e7eb' }}>
        <div className="px-4 py-4" style={{ borderBottom: '1px solid #f0f2f5' }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#f0f2f5' }}>
              <Star size={16} style={{ color: '#374151' }} />
            </div>
            <h1 className="text-base font-bold" style={{ color: '#111827' }}>Lealtad</h1>
          </div>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9ca3af' }}/>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por teléfono o nombre..."
              style={{ ...inputStyle, paddingLeft: 32 }}
              onFocus={e => (e.currentTarget.style.borderColor = '#111827')}
              onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {customers?.map(c => {
            const cfg = TIER_CFG[c.tier] ?? TIER_CFG['bronze']
            return (
              <button key={c.id} onClick={() => setActivePhone(c.phone)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition text-left"
                style={activePhone === c.phone
                  ? { background: '#f0f2f5', border: '1px solid #d1d5db' }
                  : { background: '#ffffff', border: '1px solid #f0f2f5' }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: cfg.bg, color: cfg.fg }}>
                  <Phone size={13}/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: '#111827' }}>{c.full_name || c.phone}</p>
                  <p className="text-xs" style={{ color: '#9ca3af' }}>{c.points} pts · {cfg.label}</p>
                </div>
              </button>
            )
          })}
          {(!customers || customers.length === 0) && (
            <div className="text-center py-12" style={{ color: '#d1d5db' }}>
              <Star size={32} className="mx-auto mb-2 opacity-30"/>
              <p className="text-sm">Sin clientes de lealtad aún</p>
              <p className="text-xs mt-1 px-4">Se registran solos al pagar una orden con teléfono de cliente</p>
            </div>
          )}
        </div>
      </div>

      {/* Panel principal */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeCustomer && tierCfg ? (
          <div className="max-w-2xl space-y-6">
            <div className="rounded-2xl p-5 flex items-center gap-4" style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}>
              <div className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: tierCfg.bg, color: tierCfg.fg }}>
                <Award size={24}/>
              </div>
              <div className="flex-1">
                <p className="font-bold text-lg" style={{ color: '#111827' }}>{activeCustomer.full_name || activeCustomer.phone}</p>
                <p className="text-xs" style={{ color: '#9ca3af' }}>{activeCustomer.phone}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black" style={{ color: '#111827' }}>{activeCustomer.points}</p>
                <p className="text-xs font-semibold" style={{ color: tierCfg.fg }}>{tierCfg.label} · puntos</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl p-4" style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#9ca3af' }}>Visitas</p>
                <p className="text-xl font-black" style={{ color: '#111827' }}>{activeCustomer.total_visits}</p>
              </div>
              <div className="rounded-2xl p-4" style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#9ca3af' }}>Gasto total</p>
                <p className="text-xl font-black" style={{ color: '#111827' }}>${Number(activeCustomer.total_spent).toFixed(2)}</p>
              </div>
            </div>

            <div>
              <p className="text-sm font-bold mb-2" style={{ color: '#111827' }}>Recompensas disponibles</p>
              <div className="space-y-2">
                {rewards?.filter(r => r.is_active).map(r => (
                  <div key={r.id} className="flex items-center justify-between px-4 py-3 rounded-xl"
                    style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}>
                    <div className="flex items-center gap-3">
                      <Gift size={16} style={{ color: '#6b7280' }}/>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: '#111827' }}>{r.name}</p>
                        <p className="text-xs" style={{ color: '#9ca3af' }}>{r.points_required} puntos</p>
                      </div>
                    </div>
                    <button onClick={() => redeem.mutate(r.id)}
                      disabled={activeCustomer.points < r.points_required || redeem.isPending}
                      className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white transition disabled:opacity-30"
                      style={{ background: '#111827' }}>
                      Canjear
                    </button>
                  </div>
                ))}
                {(!rewards || rewards.filter(r => r.is_active).length === 0) && (
                  <p className="text-sm" style={{ color: '#9ca3af' }}>No hay recompensas configuradas todavía</p>
                )}
              </div>
            </div>

            {activeCustomer.loyalty_transactions && activeCustomer.loyalty_transactions.length > 0 && (
              <div>
                <p className="text-sm font-bold mb-2" style={{ color: '#111827' }}>Historial</p>
                <div className="space-y-1.5">
                  {activeCustomer.loyalty_transactions
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                    .map(t => (
                    <div key={t.id} className="flex items-center justify-between px-4 py-2.5 rounded-xl text-sm"
                      style={{ background: '#f9fafb', border: '1px solid #f0f2f5' }}>
                      <span style={{ color: '#374151' }}>{t.description}</span>
                      <span className="font-semibold" style={{ color: t.points_earned > 0 ? '#16a34a' : '#dc2626' }}>
                        {t.points_earned > 0 ? `+${t.points_earned}` : `-${t.points_redeemed}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-2xl">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-bold" style={{ color: '#111827' }}>Catálogo de recompensas</p>
              {canManage && (
                <button onClick={() => setShowRewardModal(true)}
                  className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 font-semibold text-white transition"
                  style={{ background: '#111827' }}>
                  <Plus size={13}/> Nueva recompensa
                </button>
              )}
            </div>
            <div className="space-y-2">
              {rewards?.map(r => (
                <div key={r.id} className="flex items-center justify-between px-4 py-3 rounded-xl"
                  style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}>
                  <div className="flex items-center gap-3">
                    <Gift size={16} style={{ color: '#6b7280' }}/>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: '#111827' }}>{r.name}</p>
                      <p className="text-xs" style={{ color: '#9ca3af' }}>{r.points_required} puntos · {r.reward_type}</p>
                    </div>
                  </div>
                  {canManage && (
                    <button onClick={() => deleteReward.mutate(r.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition"
                      style={{ color: '#9ca3af', background: '#f9fafb' }}>
                      <Trash2 size={13}/>
                    </button>
                  )}
                </div>
              ))}
              {(!rewards || rewards.length === 0) && (
                <div className="text-center py-16" style={{ color: '#d1d5db' }}>
                  <TrendingUp size={36} className="mx-auto mb-2 opacity-30"/>
                  <p className="text-sm">Selecciona un cliente a la izquierda, o crea tu primera recompensa</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal nueva recompensa */}
      {showRewardModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{ background: '#ffffff', border: '1px solid #e5e7eb', boxShadow: '0 20px 40px rgba(0,0,0,0.12)' }}>
            <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid #f0f2f5' }}>
              <h2 className="font-bold" style={{ color: '#111827' }}>Nueva recompensa</h2>
              <button onClick={() => setShowRewardModal(false)} className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ color: '#9ca3af', background: '#f9fafb' }}><X size={15}/></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#6b7280' }}>Nombre</label>
                <input value={rewardForm.name} onChange={e => setRewardForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Agua fresca gratis" style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#111827')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#6b7280' }}>Puntos requeridos</label>
                <input type="number" value={rewardForm.points_required}
                  onChange={e => setRewardForm(f => ({ ...f, points_required: e.target.value }))}
                  placeholder="50" style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#111827')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#6b7280' }}>Tipo</label>
                <select value={rewardForm.reward_type} onChange={e => setRewardForm(f => ({ ...f, reward_type: e.target.value }))}
                  style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#111827')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')}>
                  <option value="discount">Descuento</option>
                  <option value="free_item">Producto gratis</option>
                  <option value="percentage">Porcentaje</option>
                </select>
              </div>
              <button onClick={() => createReward.mutate()}
                disabled={!rewardForm.name || !rewardForm.points_required || createReward.isPending}
                className="w-full text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-40"
                style={{ background: '#111827' }}>
                <Plus size={15}/> {createReward.isPending ? 'Creando...' : 'Crear recompensa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
