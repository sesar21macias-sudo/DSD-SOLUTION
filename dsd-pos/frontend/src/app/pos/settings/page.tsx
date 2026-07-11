'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'
import { Settings, Save, Globe, DollarSign, Phone, MapPin, Clock, Image, Percent, Copy, Check } from 'lucide-react'

interface TenantSettings {
  id: string; name: string; slug: string; logo_url: string | null
  currency: 'MXN' | 'USD'; tax_rate: number; plan: string
  address: string | null; phone: string | null; hours: string | null; description: string | null
}

const input: React.CSSProperties = {
  width: '100%', background: '#f9fafb', border: '1px solid #e5e7eb',
  borderRadius: '10px', padding: '10px 14px', fontSize: '14px',
  color: '#111827', outline: 'none', transition: 'border-color .15s',
  fontFamily: 'inherit',
}

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        {icon}{label}
      </label>
      {children}
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: '24px 28px' }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 20 }}>{title}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{children}</div>
    </div>
  )
}

export default function SettingsPage() {
  const qc = useQueryClient()
  const [copied, setCopied] = useState(false)

  const { data, isLoading } = useQuery<TenantSettings>({
    queryKey: ['tenant-settings'],
    queryFn: async () => {
      const { data } = await api.get('/settings')
      return data.data
    },
  })

  const [form, setForm] = useState({
    name: '', logo_url: '', currency: 'MXN' as 'MXN' | 'USD',
    tax_rate: 16, address: '', phone: '', hours: '', description: '',
  })

  useEffect(() => {
    if (!data) return
    setForm({
      name:        data.name ?? '',
      logo_url:    data.logo_url ?? '',
      currency:    data.currency ?? 'MXN',
      tax_rate:    data.tax_rate != null ? Math.round(data.tax_rate * 100) : 16,
      address:     data.address ?? '',
      phone:       data.phone ?? '',
      hours:       data.hours ?? '',
      description: data.description ?? '',
    })
  }, [data])

  const save = useMutation({
    mutationFn: () => api.put('/settings', {
      name:        form.name,
      logo_url:    form.logo_url || undefined,
      currency:    form.currency,
      tax_rate:    form.tax_rate / 100,
      address:     form.address || undefined,
      phone:       form.phone   || undefined,
      hours:       form.hours   || undefined,
      description: form.description || undefined,
    }),
    onSuccess: () => {
      toast.success('Configuracion guardada')
      qc.invalidateQueries({ queryKey: ['tenant-settings'] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Error al guardar'),
  })

  function copySlug() {
    if (!data?.slug) return
    navigator.clipboard.writeText(`https://dsd-solution.vercel.app/${data.slug}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (isLoading) return (
    <div style={{ padding: 40, display: 'flex', alignItems: 'center', gap: 12, color: '#6b7280', fontSize: 14 }}>
      <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="12"/>
      </svg>
      Cargando configuracion...
    </div>
  )

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '32px 40px', background: '#f5f6fa' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Settings size={20} color="#111827" />
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111827', letterSpacing: '-0.02em' }}>Configuracion del negocio</h1>
          </div>
          <p style={{ fontSize: 13, color: '#6b7280' }}>Edita el nombre, logo, contacto y preferencias de tu restaurante</p>
        </div>
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#111827', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 22px', fontSize: 14, fontWeight: 700, cursor: save.isPending ? 'wait' : 'pointer', opacity: save.isPending ? 0.7 : 1, transition: 'opacity .15s' }}
        >
          <Save size={15} />
          {save.isPending ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 20, maxWidth: 1000 }}>

        {/* Identidad */}
        <Card title="Identidad del negocio">
          <Field label="Nombre del restaurante" icon={<Settings size={11} />}>
            <input style={input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Tacos El Guero"
              onFocus={e => (e.currentTarget.style.borderColor = '#111827')}
              onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')} />
          </Field>
          <Field label="Descripcion breve" icon={<Settings size={11} />}>
            <textarea rows={2} style={{ ...input, resize: 'vertical' }}
              value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Tacos, quesadillas y mas. Preparados al momento..."
              onFocus={e => (e.currentTarget.style.borderColor = '#111827')}
              onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')} />
          </Field>
          <Field label="URL de logo (imagen)" icon={<Image size={11} />}>
            <input style={input} value={form.logo_url} onChange={e => setForm(f => ({ ...f, logo_url: e.target.value }))}
              placeholder="https://..."
              onFocus={e => (e.currentTarget.style.borderColor = '#111827')}
              onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')} />
            {form.logo_url && (
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                <img src={form.logo_url} alt="Logo preview" style={{ width: 52, height: 52, objectFit: 'contain', borderRadius: 10, border: '1px solid #e5e7eb', background: '#f9fafb', padding: 4 }} onError={e => { e.currentTarget.style.display = 'none' }} />
                <span style={{ fontSize: 12, color: '#6b7280' }}>Vista previa del logo</span>
              </div>
            )}
          </Field>
        </Card>

        {/* Contacto */}
        <Card title="Contacto e informacion">
          <Field label="Direccion" icon={<MapPin size={11} />}>
            <input style={input} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              placeholder="Av. Reforma 245, Col. Centro, CDMX"
              onFocus={e => (e.currentTarget.style.borderColor = '#111827')}
              onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')} />
          </Field>
          <Field label="Telefono" icon={<Phone size={11} />}>
            <input style={input} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="(55) 1234-5678"
              onFocus={e => (e.currentTarget.style.borderColor = '#111827')}
              onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')} />
          </Field>
          <Field label="Horarios" icon={<Clock size={11} />}>
            <input style={input} value={form.hours} onChange={e => setForm(f => ({ ...f, hours: e.target.value }))}
              placeholder="Lun-Dom 8am - 10pm"
              onFocus={e => (e.currentTarget.style.borderColor = '#111827')}
              onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')} />
          </Field>
        </Card>

        {/* Finanzas */}
        <Card title="Moneda e impuestos">
          <Field label="Moneda principal" icon={<DollarSign size={11} />}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {(['MXN', 'USD'] as const).map(c => (
                <button key={c} type="button" onClick={() => setForm(f => ({ ...f, currency: c }))}
                  style={{ padding: '10px 0', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', border: 'none', transition: 'all .15s',
                    ...(form.currency === c
                      ? { background: '#111827', color: '#fff' }
                      : { background: '#f9fafb', color: '#6b7280', border: '1px solid #e5e7eb' }) }}>
                  {c === 'MXN' ? '🇲🇽 MXN' : '🇺🇸 USD'}
                </button>
              ))}
            </div>
          </Field>
          <Field label="IVA / Tax rate (%)" icon={<Percent size={11} />}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="number" min={0} max={30} style={{ ...input, width: 100 }}
                value={form.tax_rate} onChange={e => setForm(f => ({ ...f, tax_rate: Number(e.target.value) }))}
                onFocus={e => (e.currentTarget.style.borderColor = '#111827')}
                onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')} />
              <span style={{ fontSize: 13, color: '#6b7280' }}>% — en Mexico generalmente 16%</span>
            </div>
          </Field>
        </Card>

        {/* URL pública */}
        <Card title="URL publica del restaurante">
          <div>
            <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 10, lineHeight: 1.6 }}>
              Este es el link que le das a tus clientes para ordenar en linea y unirse al programa de lealtad.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 14px' }}>
              <Globe size={14} color="#9ca3af" />
              <span style={{ fontSize: 13, color: '#374151', flex: 1, fontFamily: 'monospace' }}>
                dsd-solution.vercel.app/<strong>{data?.slug}</strong>
              </span>
              <button onClick={copySlug}
                style={{ display: 'flex', alignItems: 'center', gap: 5, background: copied ? '#f0fdf4' : '#fff', border: `1px solid ${copied ? '#bbf7d0' : '#e5e7eb'}`, borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 600, color: copied ? '#15803d' : '#374151', cursor: 'pointer', transition: 'all .2s' }}>
                {copied ? <><Check size={12} /> Copiado</> : <><Copy size={12} /> Copiar</>}
              </button>
            </div>
            <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 8 }}>
              El slug (<strong>{data?.slug}</strong>) no se puede cambiar despues de creado.
            </p>
          </div>

          {/* Plan badge */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 10, padding: '12px 16px' }}>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Plan actual</p>
              <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Contacta a DSD para upgrades</p>
            </div>
            <span style={{ background: '#111827', color: '#fff', borderRadius: 8, padding: '4px 12px', fontSize: 12, fontWeight: 700, textTransform: 'capitalize' }}>
              {data?.plan ?? 'basic'}
            </span>
          </div>
        </Card>
      </div>

      {/* Save button bottom */}
      <div style={{ marginTop: 32, maxWidth: 1000 }}>
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#111827', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 28px', fontSize: 14, fontWeight: 700, cursor: save.isPending ? 'wait' : 'pointer', opacity: save.isPending ? 0.7 : 1 }}
        >
          <Save size={15} />
          {save.isPending ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  )
}
