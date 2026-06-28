'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'
import { Package, Plus, X, Check, AlertTriangle, ArrowUp, ArrowDown, BookOpen, Pencil, Lock, Eye, ShieldCheck, Settings } from 'lucide-react'

interface Ingredient {
  id: string; name: string; unit: string
  stock: number; min_stock: number; cost_per_unit: number; category?: string
}
interface Product { id: string; name: string; menu_categories?: { name: string } }
interface RecipeItem { ingredient_id: string; quantity: number; unit: string; ingredients?: { name: string; unit: string } }

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-800 flex-shrink-0">
          <h2 className="font-bold text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={18} /></button>
        </div>
        <div className="p-4 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

const RECIPE_PIN_KEY = 'pos_recipe_pin'
const DEFAULT_PIN = '1234'

function getStoredPin(): string {
  if (typeof window === 'undefined') return DEFAULT_PIN
  return localStorage.getItem(RECIPE_PIN_KEY) ?? DEFAULT_PIN
}

type Tab = 'stock' | 'movements' | 'recipes'

export default function InventoryPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('stock')
  const [showIngModal, setShowIngModal] = useState(false)
  const [showMovModal, setShowMovModal] = useState(false)
  const [showRecipeModal, setShowRecipeModal] = useState(false)
  const [showViewRecipeModal, setShowViewRecipeModal] = useState(false)
  const [showPinModal, setShowPinModal] = useState(false)
  const [showChangePinModal, setShowChangePinModal] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState(false)
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [pendingViewProduct, setPendingViewProduct] = useState<Product | null>(null)
  const [editingIng, setEditingIng] = useState<Ingredient | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

  const [ingForm, setIngForm] = useState({ name: '', unit: 'kg', stock: '', min_stock: '', cost_per_unit: '', category: '' })
  const [movForm, setMovForm] = useState({ ingredient_id: '', type: 'in' as 'in'|'out'|'adjustment'|'waste', quantity: '', notes: '' })
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

  const { data: currentRecipe } = useQuery<RecipeItem[]>({
    queryKey: ['recipe', selectedProduct?.id],
    queryFn: async () => { const { data } = await api.get(`/inventory/recipes/${selectedProduct!.id}`); return data.data },
    enabled: !!selectedProduct,
    onSuccess: (data: RecipeItem[]) => {
      setRecipeItems(data.map((r: RecipeItem) => ({
        ingredient_id: r.ingredient_id,
        quantity: String(r.quantity),
        unit: r.unit,
      })))
    },
  } as Parameters<typeof useQuery>[0])

  const { data: viewRecipe } = useQuery<RecipeItem[]>({
    queryKey: ['recipe-view', pendingViewProduct?.id],
    queryFn: async () => { const { data } = await api.get(`/inventory/recipes/${pendingViewProduct!.id}`); return data.data },
    enabled: !!pendingViewProduct && showViewRecipeModal,
  })

  function handleViewRecipe(p: Product) {
    setPendingViewProduct(p)
    setPinInput('')
    setPinError(false)
    setShowPinModal(true)
  }

  function handlePinSubmit() {
    if (pinInput === getStoredPin()) {
      setShowPinModal(false)
      setShowViewRecipeModal(true)
      setPinInput('')
      setPinError(false)
    } else {
      setPinError(true)
      setPinInput('')
    }
  }

  function handleChangePin() {
    if (newPin.length < 4) { toast.error('El PIN debe tener al menos 4 dígitos'); return }
    if (newPin !== confirmPin) { toast.error('Los PINs no coinciden'); return }
    localStorage.setItem(RECIPE_PIN_KEY, newPin)
    toast.success('PIN actualizado')
    setShowChangePinModal(false)
    setNewPin('')
    setConfirmPin('')
  }

  const saveIngredient = useMutation({
    mutationFn: () => {
      const payload = {
        name: ingForm.name, unit: ingForm.unit,
        stock: parseFloat(ingForm.stock) || 0,
        min_stock: parseFloat(ingForm.min_stock) || 0,
        cost_per_unit: parseFloat(ingForm.cost_per_unit) || 0,
        category: ingForm.category || undefined,
      }
      return editingIng
        ? api.put(`/inventory/ingredients/${editingIng.id}`, payload)
        : api.post('/inventory/ingredients', payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ingredients'] })
      qc.invalidateQueries({ queryKey: ['low-stock'] })
      toast.success(editingIng ? 'Ingrediente actualizado' : 'Ingrediente creado')
      setShowIngModal(false)
      setEditingIng(null)
      setIngForm({ name: '', unit: 'kg', stock: '', min_stock: '', cost_per_unit: '', category: '' })
    },
    onError: () => toast.error('Error al guardar'),
  })

  const saveMovement = useMutation({
    mutationFn: () => api.post('/inventory/movements', {
      ingredient_id: movForm.ingredient_id,
      type: movForm.type,
      quantity: parseFloat(movForm.quantity),
      notes: movForm.notes || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ingredients'] })
      qc.invalidateQueries({ queryKey: ['movements'] })
      qc.invalidateQueries({ queryKey: ['low-stock'] })
      toast.success('Movimiento registrado')
      setShowMovModal(false)
      setMovForm({ ingredient_id: '', type: 'in', quantity: '', notes: '' })
    },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error'),
  })

  const saveRecipe = useMutation({
    mutationFn: () => api.post(`/inventory/recipes/${selectedProduct!.id}`, {
      items: recipeItems
        .filter(r => r.ingredient_id && r.quantity)
        .map(r => ({ ingredient_id: r.ingredient_id, quantity: parseFloat(r.quantity), unit: r.unit })),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recipe', selectedProduct?.id] })
      toast.success('Receta guardada')
      setShowRecipeModal(false)
      setSelectedProduct(null)
    },
    onError: () => toast.error('Error al guardar receta'),
  })

  function openEdit(ing: Ingredient) {
    setEditingIng(ing)
    setIngForm({ name: ing.name, unit: ing.unit, stock: String(ing.stock), min_stock: String(ing.min_stock), cost_per_unit: String(ing.cost_per_unit), category: ing.category ?? '' })
    setShowIngModal(true)
  }

  function openRecipe(p: Product) {
    setSelectedProduct(p)
    setRecipeItems([])
    setShowRecipeModal(true)
  }

  function addRecipeRow() {
    setRecipeItems(r => [...r, { ingredient_id: '', quantity: '', unit: 'kg' }])
  }

  const UNITS = ['kg', 'g', 'l', 'ml', 'pcs', 'oz', 'lb', 'taza', 'cdta', 'cda']
  const MOV_TYPES = [
    { key: 'in', label: 'Entrada', color: 'text-green-400' },
    { key: 'out', label: 'Salida', color: 'text-red-400' },
    { key: 'adjustment', label: 'Ajuste', color: 'text-blue-400' },
    { key: 'waste', label: 'Merma', color: 'text-yellow-400' },
  ]

  interface Movement {
    id: string
    type: string
    quantity: number
    notes?: string
    created_at: string
    ingredients?: { name: string; unit: string }
    users?: { full_name: string }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center gap-3">
        <Package className="text-orange-400" size={20} />
        <h1 className="text-lg font-bold text-white">Inventario</h1>
        {(lowStock?.length ?? 0) > 0 && (
          <span className="flex items-center gap-1 text-xs bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full">
            <AlertTriangle size={11} /> {lowStock?.length} stock bajo
          </span>
        )}
        <div className="ml-auto flex gap-2">
          <button onClick={() => setShowChangePinModal(true)}
            className="bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white text-sm px-3 py-1.5 rounded-lg flex items-center gap-1 transition">
            <Settings size={13} /> PIN recetas
          </button>
          <button onClick={() => setShowMovModal(true)}
            className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-3 py-1.5 rounded-lg flex items-center gap-1 transition">
            <ArrowUp size={13} /> Movimiento
          </button>
          <button onClick={() => { setEditingIng(null); setIngForm({ name: '', unit: 'kg', stock: '', min_stock: '', cost_per_unit: '', category: '' }); setShowIngModal(true) }}
            className="bg-orange-500 hover:bg-orange-600 text-white text-sm px-3 py-1.5 rounded-lg flex items-center gap-1 transition">
            <Plus size={13} /> Ingrediente
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 flex gap-4">
        {([
          { key: 'stock', label: 'Stock actual' },
          { key: 'movements', label: 'Movimientos' },
          { key: 'recipes', label: 'Recetas' },
        ] as { key: Tab; label: string }[]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`py-3 text-sm font-medium border-b-2 transition ${tab === t.key ? 'border-orange-500 text-orange-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">

        {/* ── STOCK ── */}
        {tab === 'stock' && (
          <div className="space-y-2">
            {ingredients?.map(ing => {
              const isLow = Number(ing.stock) <= Number(ing.min_stock)
              const pct = ing.min_stock > 0 ? Math.min(100, (Number(ing.stock) / Number(ing.min_stock)) * 50) : 100
              return (
                <div key={ing.id} className={`bg-gray-900 border rounded-xl px-4 py-3 flex items-center gap-4 ${isLow ? 'border-red-500/40' : 'border-gray-800'}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-white text-sm">{ing.name}</p>
                      {isLow && <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full border border-red-500/30">Stock bajo</span>}
                      {ing.category && <span className="text-xs text-gray-500">{ing.category}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <div className="flex-1 h-1.5 bg-gray-800 rounded-full max-w-32">
                        <div className={`h-1.5 rounded-full ${isLow ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-gray-500">mín: {ing.min_stock} {ing.unit}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-black text-lg ${isLow ? 'text-red-400' : 'text-white'}`}>
                      {Number(ing.stock).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">{ing.unit}</p>
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    <p>${Number(ing.cost_per_unit).toFixed(2)}</p>
                    <p>por {ing.unit}</p>
                  </div>
                  <button onClick={() => openEdit(ing)} className="text-gray-400 hover:text-white transition">
                    <Pencil size={14} />
                  </button>
                </div>
              )
            })}
            {(!ingredients || ingredients.length === 0) && (
              <div className="text-center py-12 text-gray-600">
                <Package size={40} className="mx-auto mb-2 opacity-30" />
                <p>No hay ingredientes. Agrega uno para empezar.</p>
              </div>
            )}
          </div>
        )}

        {/* ── MOVIMIENTOS ── */}
        {tab === 'movements' && (
          <div className="space-y-2">
            {(movements as Movement[])?.map((m) => {
              const cfg = MOV_TYPES.find(t => t.key === m.type) ?? MOV_TYPES[0]
              return (
                <div key={m.id} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${m.type === 'in' ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                    {m.type === 'in' ? <ArrowDown size={16} className="text-green-400" /> : <ArrowUp size={16} className="text-red-400" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-white font-medium">{(m.ingredients as { name: string })?.name}</p>
                    <p className="text-xs text-gray-500">{m.notes ?? 'Sin notas'} · {(m.users as { full_name: string })?.full_name}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold text-sm ${cfg.color}`}>{m.type === 'in' ? '+' : '-'}{m.quantity} {(m.ingredients as { unit: string })?.unit}</p>
                    <p className="text-xs text-gray-600">{new Date(m.created_at).toLocaleString('es-MX', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${cfg.color} bg-transparent border-current opacity-60`}>{cfg.label}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* ── RECETAS ── */}
        {tab === 'recipes' && (
          <div className="space-y-2">
            {products?.map(p => (
              <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-center gap-4">
                <div className="flex-1">
                  <p className="font-semibold text-white text-sm">{p.name}</p>
                  <p className="text-xs text-gray-500">{p.menu_categories?.name}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleViewRecipe(p)}
                    className="flex items-center gap-1.5 text-xs bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 px-3 py-1.5 rounded-lg transition">
                    <Eye size={13} /> Ver receta
                  </button>
                  <button onClick={() => openRecipe(p)}
                    className="flex items-center gap-1.5 text-xs bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-400 px-3 py-1.5 rounded-lg transition">
                    <BookOpen size={13} /> Editar
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
              { key: 'name', label: 'Nombre', placeholder: 'Ej: Carne de res' },
              { key: 'category', label: 'Categoría (opcional)', placeholder: 'Ej: Carnes, Lácteos...' },
              { key: 'stock', label: 'Stock actual', placeholder: '0' },
              { key: 'min_stock', label: 'Stock mínimo (alerta)', placeholder: '0' },
              { key: 'cost_per_unit', label: 'Costo por unidad ($)', placeholder: '0.00' },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="text-xs text-gray-400 mb-1 block">{label}</label>
                <input value={ingForm[key as keyof typeof ingForm]} onChange={e => setIngForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
              </div>
            ))}
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Unidad de medida</label>
              <select value={ingForm.unit} onChange={e => setIngForm(f => ({ ...f, unit: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500">
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <button onClick={() => saveIngredient.mutate()} disabled={!ingForm.name || saveIngredient.isPending}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 transition">
              <Check size={15} /> {saveIngredient.isPending ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal — Movimiento */}
      {showMovModal && (
        <Modal title="Registrar movimiento" onClose={() => setShowMovModal(false)}>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Ingrediente</label>
              <select value={movForm.ingredient_id} onChange={e => setMovForm(f => ({ ...f, ingredient_id: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500">
                <option value="">Seleccionar...</option>
                {ingredients?.map(i => <option key={i.id} value={i.id}>{i.name} ({Number(i.stock).toFixed(2)} {i.unit})</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-2 block">Tipo de movimiento</label>
              <div className="grid grid-cols-2 gap-2">
                {MOV_TYPES.map(t => (
                  <button key={t.key} onClick={() => setMovForm(f => ({ ...f, type: t.key as typeof movForm.type }))}
                    className={`py-2 rounded-lg text-sm font-medium border transition ${movForm.type === t.key ? `${t.color} border-current bg-current/10` : 'text-gray-400 border-gray-700 hover:border-gray-600'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Cantidad</label>
              <input type="number" value={movForm.quantity} onChange={e => setMovForm(f => ({ ...f, quantity: e.target.value }))}
                placeholder="0" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Notas (opcional)</label>
              <input value={movForm.notes} onChange={e => setMovForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Ej: Compra proveedor, merma por caducidad..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
            </div>
            <button onClick={() => saveMovement.mutate()} disabled={!movForm.ingredient_id || !movForm.quantity || saveMovement.isPending}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 transition">
              <Check size={15} /> {saveMovement.isPending ? 'Guardando...' : 'Registrar'}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal — PIN de seguridad */}
      {showPinModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-xs">
            <div className="p-6 text-center space-y-4">
              <div className="w-14 h-14 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto">
                <Lock size={24} className="text-blue-400" />
              </div>
              <div>
                <h2 className="font-bold text-white text-lg">Receta confidencial</h2>
                <p className="text-xs text-gray-400 mt-1">Ingresa el PIN para ver la receta de<br /><span className="text-orange-400 font-semibold">{pendingViewProduct?.name}</span></p>
              </div>
              <input
                type="password"
                value={pinInput}
                onChange={e => { setPinInput(e.target.value); setPinError(false) }}
                onKeyDown={e => e.key === 'Enter' && handlePinSubmit()}
                placeholder="••••"
                maxLength={8}
                autoFocus
                className={`w-full bg-gray-800 border rounded-xl px-4 py-3 text-white text-center text-2xl tracking-widest font-bold focus:outline-none transition ${pinError ? 'border-red-500 animate-pulse' : 'border-gray-700 focus:border-blue-500'}`}
              />
              {pinError && <p className="text-red-400 text-xs">PIN incorrecto. Intenta de nuevo.</p>}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => { setShowPinModal(false); setPinInput(''); setPendingViewProduct(null) }}
                  className="py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:text-white transition text-sm">
                  Cancelar
                </button>
                <button onClick={handlePinSubmit} disabled={!pinInput}
                  className="py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold transition text-sm flex items-center justify-center gap-1">
                  <ShieldCheck size={15} /> Acceder
                </button>
              </div>
              <p className="text-xs text-gray-600">PIN por defecto: 1234</p>
            </div>
          </div>
        </div>
      )}

      {/* Modal — Ver receta (post-PIN) */}
      {showViewRecipeModal && pendingViewProduct && (
        <Modal title={`🔒 Receta: ${pendingViewProduct.name}`} onClose={() => { setShowViewRecipeModal(false); setPendingViewProduct(null) }}>
          <div className="space-y-3">
            <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2">
              <ShieldCheck size={14} className="text-blue-400 flex-shrink-0" />
              <p className="text-xs text-blue-300">Información confidencial — no compartir</p>
            </div>

            {(!viewRecipe || viewRecipe.length === 0) ? (
              <div className="text-center py-8 text-gray-500">
                <BookOpen size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Este producto no tiene receta definida</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Ingredientes por unidad</p>
                {viewRecipe.map((r, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
                        <Package size={14} className="text-orange-400" />
                      </div>
                      <p className="text-sm text-white font-medium">{(r.ingredients as { name: string })?.name ?? r.ingredient_id}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-orange-400 font-bold text-sm">{r.quantity} {r.unit}</p>
                    </div>
                  </div>
                ))}
                <div className="bg-gray-800/50 rounded-xl px-4 py-3 mt-2">
                  <p className="text-xs text-gray-500 text-center">
                    Total de ingredientes: <span className="text-white font-semibold">{viewRecipe.length}</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Modal — Cambiar PIN */}
      {showChangePinModal && (
        <Modal title="Cambiar PIN de recetas" onClose={() => { setShowChangePinModal(false); setNewPin(''); setConfirmPin('') }}>
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3">
              <Lock size={16} className="text-yellow-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-yellow-300">Este PIN protege la visualización de recetas. Solo compártelo con personal de confianza.</p>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Nuevo PIN (mínimo 4 dígitos)</label>
              <input type="password" value={newPin} onChange={e => setNewPin(e.target.value)}
                placeholder="••••" maxLength={8}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-center text-xl tracking-widest font-bold focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Confirmar PIN</label>
              <input type="password" value={confirmPin} onChange={e => setConfirmPin(e.target.value)}
                placeholder="••••" maxLength={8}
                className={`w-full bg-gray-800 border rounded-xl px-4 py-3 text-white text-center text-xl tracking-widest font-bold focus:outline-none transition ${confirmPin && confirmPin !== newPin ? 'border-red-500' : 'border-gray-700 focus:border-orange-500'}`} />
              {confirmPin && confirmPin !== newPin && <p className="text-red-400 text-xs mt-1">Los PINs no coinciden</p>}
            </div>
            <button onClick={handleChangePin} disabled={newPin.length < 4 || newPin !== confirmPin}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition">
              <Check size={15} /> Guardar nuevo PIN
            </button>
          </div>
        </Modal>
      )}

      {/* Modal — Receta */}
      {showRecipeModal && selectedProduct && (
        <Modal title={`Receta: ${selectedProduct.name}`} onClose={() => { setShowRecipeModal(false); setSelectedProduct(null) }}>
          <div className="space-y-3">
            <p className="text-xs text-gray-400">Define qué ingredientes se usan por cada unidad de este producto.</p>
            {recipeItems.map((row, i) => (
              <div key={i} className="flex gap-2 items-center">
                <select value={row.ingredient_id} onChange={e => setRecipeItems(r => r.map((x, j) => j === i ? { ...x, ingredient_id: e.target.value } : x))}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-white text-sm focus:outline-none focus:border-orange-500">
                  <option value="">Ingrediente...</option>
                  {ingredients?.map(ing => <option key={ing.id} value={ing.id}>{ing.name}</option>)}
                </select>
                <input type="number" value={row.quantity} onChange={e => setRecipeItems(r => r.map((x, j) => j === i ? { ...x, quantity: e.target.value } : x))}
                  placeholder="Cant." className="w-20 bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
                <select value={row.unit} onChange={e => setRecipeItems(r => r.map((x, j) => j === i ? { ...x, unit: e.target.value } : x))}
                  className="w-20 bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-white text-sm focus:outline-none focus:border-orange-500">
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
                <button onClick={() => setRecipeItems(r => r.filter((_, j) => j !== i))} className="text-gray-500 hover:text-red-400 transition">
                  <X size={16} />
                </button>
              </div>
            ))}
            <button onClick={addRecipeRow} className="w-full border border-dashed border-gray-700 hover:border-orange-500 text-gray-500 hover:text-orange-400 py-2 rounded-xl text-sm transition flex items-center justify-center gap-1">
              <Plus size={14} /> Agregar ingrediente
            </button>
            <button onClick={() => saveRecipe.mutate()} disabled={saveRecipe.isPending}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 transition">
              <Check size={15} /> {saveRecipe.isPending ? 'Guardando...' : 'Guardar receta'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
