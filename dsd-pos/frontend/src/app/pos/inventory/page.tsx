'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'
import { Package, Plus, X, Check, AlertTriangle, ArrowUp, ArrowDown, BookOpen, Pencil, Lock, Eye, ShieldCheck, Settings } from 'lucide-react'

interface Ingredient { id: string; name: string; unit: string; stock: number; min_stock: number; cost_per_unit: number; category?: string }
interface Product    { id: string; name: string; menu_categories?: { name: string } }
interface RecipeItem { ingredient_id: string; quantity: number; unit: string; ingredients?: { name: string; unit: string } }

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#f9fafb', border: '1px solid #e5e7eb',
  borderRadius: '10px', padding: '9px 13px', fontSize: '14px',
  color: '#111827', outline: 'none',
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl overflow-hidden"
        style={{ background: '#ffffff', border: '1px solid #e5e7eb', boxShadow: '0 20px 40px rgba(0,0,0,0.12)' }}>
        <div className="flex items-center justify-between p-4 flex-shrink-0" style={{ borderBottom: '1px solid #f0f2f5' }}>
          <h2 className="font-bold" style={{ color: '#111827' }}>{title}</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ color: '#9ca3af', background: '#f9fafb' }}><X size={15}/></button>
        </div>
        <div className="p-4 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

const RECIPE_PIN_KEY = 'pos_recipe_pin'
const DEFAULT_PIN    = '1234'
function getStoredPin(): string {
  if (typeof window === 'undefined') return DEFAULT_PIN
  return localStorage.getItem(RECIPE_PIN_KEY) ?? DEFAULT_PIN
}

type Tab = 'stock' | 'movements' | 'recipes'

export default function InventoryPage() {
  const qc = useQueryClient()
  const [tab,                 setTab]                = useState<Tab>('stock')
  const [showIngModal,        setShowIngModal]        = useState(false)
  const [showMovModal,        setShowMovModal]        = useState(false)
  const [showRecipeModal,     setShowRecipeModal]     = useState(false)
  const [showViewRecipeModal, setShowViewRecipeModal] = useState(false)
  const [showPinModal,        setShowPinModal]        = useState(false)
  const [showChangePinModal,  setShowChangePinModal]  = useState(false)
  const [pinInput,            setPinInput]            = useState('')
  const [pinError,            setPinError]            = useState(false)
  const [newPin,              setNewPin]              = useState('')
  const [confirmPin,          setConfirmPin]          = useState('')
  const [pendingViewProduct,  setPendingViewProduct]  = useState<Product | null>(null)
  const [editingIng,          setEditingIng]          = useState<Ingredient | null>(null)
  const [selectedProduct,     setSelectedProduct]     = useState<Product | null>(null)
  const [ingForm,  setIngForm]  = useState({ name: '', unit: 'kg', stock: '', min_stock: '', cost_per_unit: '', category: '' })
  const [movForm,  setMovForm]  = useState({ ingredient_id: '', type: 'in' as 'in'|'out'|'adjustment'|'waste', quantity: '', notes: '' })
  const [recipeItems, setRecipeItems] = useState<{ ingredient_id: string; quantity: string; unit: string }[]>([])

  const { data: ingredients } = useQuery<Ingredient[]>({
    queryKey: ['ingredients'],
    queryFn: async () => { const { data } = await api.get('/inventory/ingredients'); return data.data },
  })
  const { data: lowStock } = useQuery<Ingredient[]>({
    queryKey: ['low-stock'],
    queryFn: async () => { const { data } = await api.get('/inventory/low-stock'); return data.data },
  })
  const { data: movements } = useQuery<unknown[]>({
    queryKey: ['movements'],
    queryFn: async () => { const { data } = await api.get('/inventory/movements'); return data.data },
    enabled: tab === 'movements',
  })
  const { data: products } = useQuery<Product[]>({
    queryKey: ['products-admin'],
    queryFn: async () => { const { data } = await api.get('/menu/products'); return data.data },
    enabled: tab === 'recipes' || showRecipeModal,
  })
  const { data: currentRecipe } = useQuery({
    queryKey: ['recipe', selectedProduct?.id],
    queryFn: async (): Promise<RecipeItem[]> => { const { data } = await api.get(`/inventory/recipes/${selectedProduct!.id}`); return data.data },
    enabled: !!selectedProduct,
  })

  useEffect(() => {
    if (currentRecipe) {
      setRecipeItems((currentRecipe as RecipeItem[]).map(r => ({ ingredient_id: r.ingredient_id, quantity: String(r.quantity), unit: r.unit })))
    }
  }, [currentRecipe])

  const { data: viewRecipe } = useQuery<RecipeItem[]>({
    queryKey: ['recipe-view', pendingViewProduct?.id],
    queryFn: async () => { const { data } = await api.get(`/inventory/recipes/${pendingViewProduct!.id}`); return data.data },
    enabled: !!pendingViewProduct && showViewRecipeModal,
  })

  function handleViewRecipe(p: Product) { setPendingViewProduct(p); setPinInput(''); setPinError(false); setShowPinModal(true) }
  function handlePinSubmit() {
    if (pinInput === getStoredPin()) { setShowPinModal(false); setShowViewRecipeModal(true); setPinInput(''); setPinError(false) }
    else { setPinError(true); setPinInput('') }
  }
  function handleChangePin() {
    if (newPin.length < 4) { toast.error('El PIN debe tener al menos 4 dígitos'); return }
    if (newPin !== confirmPin) { toast.error('Los PINs no coinciden'); return }
    localStorage.setItem(RECIPE_PIN_KEY, newPin)
    toast.success('PIN actualizado'); setShowChangePinModal(false); setNewPin(''); setConfirmPin('')
  }

  const saveIngredient = useMutation({
    mutationFn: () => {
      const payload = { name: ingForm.name, unit: ingForm.unit, stock: parseFloat(ingForm.stock)||0, min_stock: parseFloat(ingForm.min_stock)||0, cost_per_unit: parseFloat(ingForm.cost_per_unit)||0, category: ingForm.category||undefined }
      return editingIng ? api.put(`/inventory/ingredients/${editingIng.id}`, payload) : api.post('/inventory/ingredients', payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ingredients'] }); qc.invalidateQueries({ queryKey: ['low-stock'] })
      toast.success(editingIng ? 'Ingrediente actualizado' : 'Ingrediente creado')
      setShowIngModal(false); setEditingIng(null)
      setIngForm({ name: '', unit: 'kg', stock: '', min_stock: '', cost_per_unit: '', category: '' })
    },
    onError: () => toast.error('Error al guardar'),
  })

  const saveMovement = useMutation({
    mutationFn: () => api.post('/inventory/movements', { ingredient_id: movForm.ingredient_id, type: movForm.type, quantity: parseFloat(movForm.quantity), notes: movForm.notes || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ingredients'] }); qc.invalidateQueries({ queryKey: ['movements'] }); qc.invalidateQueries({ queryKey: ['low-stock'] })
      toast.success('Movimiento registrado'); setShowMovModal(false)
      setMovForm({ ingredient_id: '', type: 'in', quantity: '', notes: '' })
    },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error'),
  })

  const saveRecipe = useMutation({
    mutationFn: () => api.post(`/inventory/recipes/${selectedProduct!.id}`, {
      items: recipeItems.filter(r => r.ingredient_id && r.quantity).map(r => ({ ingredient_id: r.ingredient_id, quantity: parseFloat(r.quantity), unit: r.unit })),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recipe', selectedProduct?.id] })
      toast.success('Receta guardada'); setShowRecipeModal(false); setSelectedProduct(null)
    },
    onError: () => toast.error('Error al guardar receta'),
  })

  function openEdit(ing: Ingredient) {
    setEditingIng(ing); setIngForm({ name: ing.name, unit: ing.unit, stock: String(ing.stock), min_stock: String(ing.min_stock), cost_per_unit: String(ing.cost_per_unit), category: ing.category ?? '' }); setShowIngModal(true)
  }
  function openRecipe(p: Product) { setSelectedProduct(p); setRecipeItems([]); setShowRecipeModal(true) }
  function addRecipeRow() { setRecipeItems(r => [...r, { ingredient_id: '', quantity: '', unit: 'kg' }]) }

  const UNITS    = ['kg','g','l','ml','pcs','oz','lb','taza','cdta','cda']
  const MOV_TYPES = [
    { key: 'in',         label: 'Entrada',  fg: '#16a34a', bg: '#f0fdf4' },
    { key: 'out',        label: 'Salida',   fg: '#dc2626', bg: '#fef2f2' },
    { key: 'adjustment', label: 'Ajuste',   fg: '#2563eb', bg: '#eff6ff' },
    { key: 'waste',      label: 'Merma',    fg: '#d97706', bg: '#fffbeb' },
  ]

  interface Movement { id: string; type: string; quantity: number; notes?: string; created_at: string; ingredients?: { name: string; unit: string }; users?: { full_name: string } }

  const tabBtn = (active: boolean): React.CSSProperties => ({
    padding: '10px 0', fontSize: '14px', fontWeight: 500,
    borderBottom: active ? '2px solid #111827' : '2px solid transparent',
    color: active ? '#111827' : '#9ca3af', transition: 'all 0.15s',
  })

  return (
    <div className="h-full flex flex-col" style={{ background: '#f5f6fa' }}>
      {/* Header */}
      <div className="px-6 py-4 flex items-center gap-3" style={{ background: '#ffffff', borderBottom: '1px solid #e5e7eb' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#f0f2f5' }}>
          <Package size={17} style={{ color: '#374151' }} />
        </div>
        <h1 className="text-base font-bold" style={{ color: '#111827' }}>Inventario</h1>
        {(lowStock?.length ?? 0) > 0 && (
          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold"
            style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
            <AlertTriangle size={11}/> {lowStock?.length} stock bajo
          </span>
        )}
        <div className="ml-auto flex gap-2">
          <button onClick={() => setShowChangePinModal(true)}
            className="text-sm px-3 py-1.5 rounded-lg flex items-center gap-1 font-medium transition"
            style={{ background: '#f0f2f5', color: '#6b7280', border: '1px solid #e5e7eb' }}>
            <Settings size={13}/> PIN recetas
          </button>
          <button onClick={() => setShowMovModal(true)}
            className="text-sm px-3 py-1.5 rounded-lg flex items-center gap-1 font-medium transition"
            style={{ background: '#f0f2f5', color: '#374151', border: '1px solid #e5e7eb' }}>
            <ArrowUp size={13}/> Movimiento
          </button>
          <button onClick={() => { setEditingIng(null); setIngForm({ name:'',unit:'kg',stock:'',min_stock:'',cost_per_unit:'',category:'' }); setShowIngModal(true) }}
            className="text-sm px-3 py-1.5 rounded-lg flex items-center gap-1 font-semibold text-white transition"
            style={{ background: '#111827' }}>
            <Plus size={13}/> Ingrediente
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 flex gap-6" style={{ background: '#ffffff', borderBottom: '1px solid #e5e7eb' }}>
        {([{ key:'stock',label:'Stock actual'},{key:'movements',label:'Movimientos'},{key:'recipes',label:'Recetas'}] as {key:Tab;label:string}[]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={tabBtn(tab === t.key)}>{t.label}</button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* STOCK */}
        {tab === 'stock' && (
          <div className="space-y-2">
            {ingredients?.map(ing => {
              const isLow = Number(ing.stock) <= Number(ing.min_stock)
              const pct   = ing.min_stock > 0 ? Math.min(100, (Number(ing.stock)/Number(ing.min_stock))*50) : 100
              return (
                <div key={ing.id} className="flex items-center gap-4 px-4 py-3 rounded-xl"
                  style={{ background: '#ffffff', border: `1px solid ${isLow ? '#fecaca' : '#e5e7eb'}` }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm" style={{ color: '#111827' }}>{ing.name}</p>
                      {isLow && <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ background: '#fef2f2', color: '#dc2626' }}>Stock bajo</span>}
                      {ing.category && <span className="text-xs" style={{ color: '#9ca3af' }}>{ing.category}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <div className="flex-1 h-1.5 rounded-full max-w-32" style={{ background: '#f0f2f5' }}>
                        <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: isLow ? '#ef4444' : '#16a34a' }} />
                      </div>
                      <span className="text-xs" style={{ color: '#9ca3af' }}>mín: {ing.min_stock} {ing.unit}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-lg" style={{ color: isLow ? '#dc2626' : '#111827' }}>{Number(ing.stock).toFixed(2)}</p>
                    <p className="text-xs" style={{ color: '#9ca3af' }}>{ing.unit}</p>
                  </div>
                  <div className="text-right text-xs" style={{ color: '#9ca3af' }}>
                    <p>${Number(ing.cost_per_unit).toFixed(2)}</p><p>por {ing.unit}</p>
                  </div>
                  <button onClick={() => openEdit(ing)} className="w-7 h-7 rounded-lg flex items-center justify-center transition"
                    style={{ color: '#9ca3af', background: '#f9fafb' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#111827')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}>
                    <Pencil size={13}/>
                  </button>
                </div>
              )
            })}
            {(!ingredients||ingredients.length===0) && (
              <div className="text-center py-12" style={{ color: '#d1d5db' }}>
                <Package size={40} className="mx-auto mb-2 opacity-30"/>
                <p>No hay ingredientes. Agrega uno para empezar.</p>
              </div>
            )}
          </div>
        )}

        {/* MOVIMIENTOS */}
        {tab === 'movements' && (
          <div className="space-y-2">
            {(movements as Movement[])?.map(m => {
              const cfg = MOV_TYPES.find(t => t.key === m.type) ?? MOV_TYPES[0]
              return (
                <div key={m.id} className="flex items-center gap-4 px-4 py-3 rounded-xl"
                  style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: cfg.bg }}>
                    {m.type === 'in' ? <ArrowDown size={16} style={{ color: cfg.fg }}/> : <ArrowUp size={16} style={{ color: cfg.fg }}/>}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium" style={{ color: '#111827' }}>{(m.ingredients as { name: string })?.name}</p>
                    <p className="text-xs" style={{ color: '#9ca3af' }}>{m.notes ?? 'Sin notas'} · {(m.users as { full_name: string })?.full_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm" style={{ color: cfg.fg }}>{m.type === 'in' ? '+' : '-'}{m.quantity} {(m.ingredients as { unit: string })?.unit}</p>
                    <p className="text-xs" style={{ color: '#9ca3af' }}>{new Date(m.created_at).toLocaleString('es-MX',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: cfg.bg, color: cfg.fg }}>{cfg.label}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* RECETAS */}
        {tab === 'recipes' && (
          <div className="space-y-2">
            {products?.map(p => (
              <div key={p.id} className="flex items-center gap-4 px-4 py-3 rounded-xl"
                style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}>
                <div className="flex-1">
                  <p className="font-semibold text-sm" style={{ color: '#111827' }}>{p.name}</p>
                  <p className="text-xs" style={{ color: '#9ca3af' }}>{p.menu_categories?.name}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleViewRecipe(p)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition"
                    style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}>
                    <Eye size={13}/> Ver receta
                  </button>
                  <button onClick={() => openRecipe(p)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition"
                    style={{ background: '#f0f2f5', color: '#374151', border: '1px solid #e5e7eb' }}>
                    <BookOpen size={13}/> Editar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal — Ingrediente */}
      {showIngModal && (
        <Modal title={editingIng ? 'Editar ingrediente' : 'Nuevo ingrediente'} onClose={() => setShowIngModal(false)}>
          <div className="space-y-3">
            {[
              { key:'name',          label:'Nombre',                 placeholder:'Ej: Carne de res' },
              { key:'category',      label:'Categoría (opcional)',    placeholder:'Ej: Carnes, Lácteos...' },
              { key:'stock',         label:'Stock actual',            placeholder:'0' },
              { key:'min_stock',     label:'Stock mínimo (alerta)',   placeholder:'0' },
              { key:'cost_per_unit', label:'Costo por unidad ($)',    placeholder:'0.00' },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#6b7280' }}>{label}</label>
                <input value={ingForm[key as keyof typeof ingForm]} onChange={e => setIngForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder} style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#111827')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')} />
              </div>
            ))}
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: '#6b7280' }}>Unidad de medida</label>
              <select value={ingForm.unit} onChange={e => setIngForm(f => ({ ...f, unit: e.target.value }))} style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#111827')}
                onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')}>
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <button onClick={() => saveIngredient.mutate()} disabled={!ingForm.name || saveIngredient.isPending}
              className="w-full text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-40"
              style={{ background: '#111827' }}>
              <Check size={15}/> {saveIngredient.isPending ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal — Movimiento */}
      {showMovModal && (
        <Modal title="Registrar movimiento" onClose={() => setShowMovModal(false)}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: '#6b7280' }}>Ingrediente</label>
              <select value={movForm.ingredient_id} onChange={e => setMovForm(f => ({ ...f, ingredient_id: e.target.value }))} style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#111827')}
                onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')}>
                <option value="">Seleccionar...</option>
                {ingredients?.map(i => <option key={i.id} value={i.id}>{i.name} ({Number(i.stock).toFixed(2)} {i.unit})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-2" style={{ color: '#6b7280' }}>Tipo de movimiento</label>
              <div className="grid grid-cols-2 gap-2">
                {MOV_TYPES.map(t => (
                  <button key={t.key} onClick={() => setMovForm(f => ({ ...f, type: t.key as typeof movForm.type }))}
                    className="py-2 rounded-lg text-sm font-medium border transition"
                    style={movForm.type === t.key
                      ? { background: t.bg, color: t.fg, border: `1px solid ${t.fg}` }
                      : { background: '#f9fafb', color: '#9ca3af', border: '1px solid #e5e7eb' }}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: '#6b7280' }}>Cantidad</label>
              <input type="number" value={movForm.quantity} onChange={e => setMovForm(f => ({ ...f, quantity: e.target.value }))}
                placeholder="0" style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#111827')}
                onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: '#6b7280' }}>Notas (opcional)</label>
              <input value={movForm.notes} onChange={e => setMovForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Ej: Compra proveedor..." style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#111827')}
                onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')} />
            </div>
            <button onClick={() => saveMovement.mutate()} disabled={!movForm.ingredient_id || !movForm.quantity || saveMovement.isPending}
              className="w-full text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-40"
              style={{ background: '#111827' }}>
              <Check size={15}/> {saveMovement.isPending ? 'Guardando...' : 'Registrar'}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal — PIN */}
      {showPinModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-xs rounded-2xl overflow-hidden" style={{ background: '#ffffff', border: '1px solid #e5e7eb', boxShadow: '0 20px 40px rgba(0,0,0,0.12)' }}>
            <div className="p-6 text-center space-y-4">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto" style={{ background: '#eff6ff' }}>
                <Lock size={24} style={{ color: '#2563eb' }} />
              </div>
              <div>
                <h2 className="font-bold text-lg" style={{ color: '#111827' }}>Receta confidencial</h2>
                <p className="text-xs mt-1" style={{ color: '#6b7280' }}>
                  Ingresa el PIN para ver la receta de<br/>
                  <span className="font-semibold" style={{ color: '#111827' }}>{pendingViewProduct?.name}</span>
                </p>
              </div>
              <input type="password" value={pinInput} onChange={e => { setPinInput(e.target.value); setPinError(false) }}
                onKeyDown={e => e.key === 'Enter' && handlePinSubmit()} placeholder="••••" maxLength={8} autoFocus
                style={{ ...inputStyle, textAlign: 'center', fontSize: '24px', fontWeight: 700, letterSpacing: '0.2em',
                  borderColor: pinError ? '#ef4444' : '#e5e7eb' }} />
              {pinError && <p className="text-xs" style={{ color: '#ef4444' }}>PIN incorrecto. Intenta de nuevo.</p>}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => { setShowPinModal(false); setPinInput(''); setPendingViewProduct(null) }}
                  className="py-2.5 rounded-xl text-sm font-medium transition"
                  style={{ background: '#f0f2f5', color: '#374151' }}>
                  Cancelar
                </button>
                <button onClick={handlePinSubmit} disabled={!pinInput}
                  className="py-2.5 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-1 transition disabled:opacity-40"
                  style={{ background: '#2563eb' }}>
                  <ShieldCheck size={15}/> Acceder
                </button>
              </div>
              <p className="text-xs" style={{ color: '#d1d5db' }}>PIN por defecto: 1234</p>
            </div>
          </div>
        </div>
      )}

      {/* Modal — Ver receta */}
      {showViewRecipeModal && pendingViewProduct && (
        <Modal title={`🔒 Receta: ${pendingViewProduct.name}`} onClose={() => { setShowViewRecipeModal(false); setPendingViewProduct(null) }}>
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
              <ShieldCheck size={14} style={{ color: '#2563eb' }} />
              <p className="text-xs" style={{ color: '#1e40af' }}>Información confidencial — no compartir</p>
            </div>
            {(!viewRecipe||viewRecipe.length===0) ? (
              <div className="text-center py-8" style={{ color: '#9ca3af' }}>
                <BookOpen size={32} className="mx-auto mb-2 opacity-30"/>
                <p className="text-sm">Este producto no tiene receta definida</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wider font-semibold" style={{ color: '#9ca3af' }}>Ingredientes por unidad</p>
                {viewRecipe.map((r, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: '#f9fafb', border: '1px solid #f0f2f5' }}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#f0f2f5' }}>
                        <Package size={13} style={{ color: '#6b7280' }} />
                      </div>
                      <p className="text-sm font-medium" style={{ color: '#111827' }}>{(r.ingredients as { name: string })?.name ?? r.ingredient_id}</p>
                    </div>
                    <p className="font-bold text-sm" style={{ color: '#111827' }}>{r.quantity} {r.unit}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Modal — Cambiar PIN */}
      {showChangePinModal && (
        <Modal title="Cambiar PIN de recetas" onClose={() => { setShowChangePinModal(false); setNewPin(''); setConfirmPin('') }}>
          <div className="space-y-4">
            <div className="flex items-start gap-3 px-3 py-2 rounded-xl" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
              <Lock size={15} style={{ color: '#d97706', marginTop: 1 }} />
              <p className="text-xs" style={{ color: '#92400e' }}>Este PIN protege la visualización de recetas. Solo compártelo con personal de confianza.</p>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: '#6b7280' }}>Nuevo PIN (mínimo 4 dígitos)</label>
              <input type="password" value={newPin} onChange={e => setNewPin(e.target.value)} placeholder="••••" maxLength={8}
                style={{ ...inputStyle, textAlign: 'center', fontSize: '20px', fontWeight: 700, letterSpacing: '0.2em' }}
                onFocus={e => (e.currentTarget.style.borderColor = '#111827')}
                onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: '#6b7280' }}>Confirmar PIN</label>
              <input type="password" value={confirmPin} onChange={e => setConfirmPin(e.target.value)} placeholder="••••" maxLength={8}
                style={{ ...inputStyle, textAlign: 'center', fontSize: '20px', fontWeight: 700, letterSpacing: '0.2em',
                  borderColor: confirmPin && confirmPin !== newPin ? '#ef4444' : '#e5e7eb' }}
                onFocus={e => { if (!(confirmPin && confirmPin !== newPin)) e.currentTarget.style.borderColor = '#111827' }}
                onBlur={e => { if (!(confirmPin && confirmPin !== newPin)) e.currentTarget.style.borderColor = '#e5e7eb' }} />
              {confirmPin && confirmPin !== newPin && <p className="text-xs mt-1" style={{ color: '#ef4444' }}>Los PINs no coinciden</p>}
            </div>
            <button onClick={handleChangePin} disabled={newPin.length < 4 || newPin !== confirmPin}
              className="w-full text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-40"
              style={{ background: '#111827' }}>
              <Check size={15}/> Guardar nuevo PIN
            </button>
          </div>
        </Modal>
      )}

      {/* Modal — Receta */}
      {showRecipeModal && selectedProduct && (
        <Modal title={`Receta: ${selectedProduct.name}`} onClose={() => { setShowRecipeModal(false); setSelectedProduct(null) }}>
          <div className="space-y-3">
            <p className="text-xs" style={{ color: '#6b7280' }}>Define qué ingredientes se usan por cada unidad de este producto.</p>
            {recipeItems.map((row, i) => (
              <div key={i} className="flex gap-2 items-center">
                <select value={row.ingredient_id} onChange={e => setRecipeItems(r => r.map((x,j) => j===i ? {...x, ingredient_id: e.target.value} : x))}
                  style={{ ...inputStyle, flex: 1 }}
                  onFocus={e => (e.currentTarget.style.borderColor = '#111827')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')}>
                  <option value="">Ingrediente...</option>
                  {ingredients?.map(ing => <option key={ing.id} value={ing.id}>{ing.name}</option>)}
                </select>
                <input type="number" value={row.quantity} onChange={e => setRecipeItems(r => r.map((x,j) => j===i ? {...x,quantity:e.target.value} : x))}
                  placeholder="Cant." style={{ ...inputStyle, width: '80px' }}
                  onFocus={e => (e.currentTarget.style.borderColor = '#111827')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')} />
                <select value={row.unit} onChange={e => setRecipeItems(r => r.map((x,j) => j===i ? {...x,unit:e.target.value} : x))}
                  style={{ ...inputStyle, width: '80px' }}
                  onFocus={e => (e.currentTarget.style.borderColor = '#111827')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')}>
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
                <button onClick={() => setRecipeItems(r => r.filter((_,j) => j!==i))}
                  style={{ color: '#9ca3af' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}>
                  <X size={16}/>
                </button>
              </div>
            ))}
            <button onClick={addRecipeRow}
              className="w-full py-2 rounded-xl text-sm flex items-center justify-center gap-1 transition"
              style={{ border: '1px dashed #d1d5db', color: '#9ca3af' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#111827'; e.currentTarget.style.color = '#111827' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.color = '#9ca3af' }}>
              <Plus size={14}/> Agregar ingrediente
            </button>
            <button onClick={() => saveRecipe.mutate()} disabled={saveRecipe.isPending}
              className="w-full text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-40"
              style={{ background: '#111827' }}>
              <Check size={15}/> {saveRecipe.isPending ? 'Guardando...' : 'Guardar receta'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
