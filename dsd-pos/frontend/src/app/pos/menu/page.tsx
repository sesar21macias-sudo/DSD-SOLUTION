'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'
import { UtensilsCrossed, Plus, Pencil, Trash2, X, Check } from 'lucide-react'

interface Category { id: string; name: string; sort_order: number }
interface Product  { id: string; name: string; description?: string; price_mxn: number; price_usd?: number; category_id: string; is_active: boolean; menu_categories?: { name: string } }

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#f9fafb', border: '1px solid #e5e7eb',
  borderRadius: '10px', padding: '9px 13px', fontSize: '14px',
  color: '#111827', outline: 'none',
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: '#ffffff', border: '1px solid #e5e7eb', boxShadow: '0 20px 40px rgba(0,0,0,0.12)' }}>
        <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid #f0f2f5' }}>
          <h2 className="font-bold" style={{ color: '#111827' }}>{title}</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center transition"
            style={{ color: '#9ca3af', background: '#f9fafb' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#f0f2f5')}
            onMouseLeave={e => (e.currentTarget.style.background = '#f9fafb')}>
            <X size={15} />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}

export default function MenuPage() {
  const qc = useQueryClient()
  const [activeTab,          setActiveTab]          = useState<'products'|'categories'>('products')
  const [showProductModal,   setShowProductModal]   = useState(false)
  const [showCategoryModal,  setShowCategoryModal]  = useState(false)
  const [editingProduct,     setEditingProduct]     = useState<Product | null>(null)
  const [editingCategory,    setEditingCategory]    = useState<Category | null>(null)
  const [productForm,        setProductForm]        = useState({ name: '', description: '', price_mxn: '', price_usd: '', category_id: '' })
  const [categoryForm,       setCategoryForm]       = useState({ name: '', sort_order: '0' })

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => { const { data } = await api.get('/menu/categories'); return data.data },
  })
  const { data: products } = useQuery<Product[]>({
    queryKey: ['products-admin'],
    queryFn: async () => { const { data } = await api.get('/menu/products'); return data.data },
  })

  const saveProduct = useMutation({
    mutationFn: async () => {
      const payload = { name: productForm.name, description: productForm.description, price_mxn: parseFloat(productForm.price_mxn), price_usd: productForm.price_usd ? parseFloat(productForm.price_usd) : undefined, category_id: productForm.category_id }
      return editingProduct ? api.put(`/menu/products/${editingProduct.id}`, payload) : api.post('/menu/products', payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products-admin'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      toast.success(editingProduct ? 'Producto actualizado' : 'Producto creado')
      setShowProductModal(false); setEditingProduct(null)
      setProductForm({ name: '', description: '', price_mxn: '', price_usd: '', category_id: '' })
    },
    onError: () => toast.error('Error al guardar producto'),
  })

  const deleteProduct = useMutation({
    mutationFn: (id: string) => api.delete(`/menu/products/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products-admin'] }); toast.success('Producto eliminado') },
  })

  const saveCategory = useMutation({
    mutationFn: async () => {
      const payload = { name: categoryForm.name, sort_order: parseInt(categoryForm.sort_order) }
      return editingCategory ? api.put(`/menu/categories/${editingCategory.id}`, payload) : api.post('/menu/categories', payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] })
      toast.success(editingCategory ? 'Categoría actualizada' : 'Categoría creada')
      setShowCategoryModal(false); setEditingCategory(null)
      setCategoryForm({ name: '', sort_order: '0' })
    },
  })

  function openEditProduct(p: Product) {
    setEditingProduct(p)
    setProductForm({ name: p.name, description: p.description ?? '', price_mxn: String(p.price_mxn), price_usd: String(p.price_usd ?? ''), category_id: p.category_id })
    setShowProductModal(true)
  }
  function openEditCategory(c: Category) {
    setEditingCategory(c); setCategoryForm({ name: c.name, sort_order: String(c.sort_order) }); setShowCategoryModal(true)
  }

  const tabBtn = (active: boolean): React.CSSProperties => ({
    padding: '10px 0', fontSize: '14px', fontWeight: 500,
    borderBottom: active ? '2px solid #111827' : '2px solid transparent',
    color: active ? '#111827' : '#9ca3af',
    transition: 'all 0.15s',
  })

  return (
    <div className="h-full flex flex-col" style={{ background: '#f5f6fa' }}>
      {/* Header */}
      <div className="px-6 py-4 flex items-center gap-3" style={{ background: '#ffffff', borderBottom: '1px solid #e5e7eb' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#f0f2f5' }}>
          <UtensilsCrossed size={17} style={{ color: '#374151' }} />
        </div>
        <h1 className="text-base font-bold" style={{ color: '#111827' }}>Gestión de Menú</h1>
        <div className="flex gap-2 ml-auto">
          <button
            onClick={() => { setActiveTab('categories'); setShowCategoryModal(true); setEditingCategory(null); setCategoryForm({ name: '', sort_order: '0' }) }}
            className="text-sm px-3 py-1.5 rounded-lg flex items-center gap-1 transition font-medium"
            style={{ background: '#f0f2f5', color: '#374151', border: '1px solid #e5e7eb' }}>
            <Plus size={14}/> Categoría
          </button>
          <button
            onClick={() => { setActiveTab('products'); setShowProductModal(true); setEditingProduct(null); setProductForm({ name: '', description: '', price_mxn: '', price_usd: '', category_id: categories?.[0]?.id ?? '' }) }}
            className="text-sm px-3 py-1.5 rounded-lg flex items-center gap-1 transition font-semibold text-white"
            style={{ background: '#111827' }}>
            <Plus size={14}/> Producto
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 flex gap-6" style={{ background: '#ffffff', borderBottom: '1px solid #e5e7eb' }}>
        {(['products','categories'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={tabBtn(activeTab === tab)}>
            {tab === 'products' ? 'Productos' : 'Categorías'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {activeTab === 'products' ? (
          products?.map(p => (
            <div key={p.id} className="flex items-center gap-4 px-4 py-3 rounded-xl transition"
              style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm" style={{ color: '#111827' }}>{p.name}</p>
                <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{p.menu_categories?.name}{p.description ? ` · ${p.description}` : ''}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-sm" style={{ color: '#111827' }}>${Number(p.price_mxn).toFixed(2)}</p>
                {p.price_usd && <p className="text-xs" style={{ color: '#9ca3af' }}>USD {Number(p.price_usd).toFixed(2)}</p>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEditProduct(p)} className="w-7 h-7 rounded-lg flex items-center justify-center transition"
                  style={{ color: '#9ca3af', background: '#f9fafb' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#111827')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}>
                  <Pencil size={14}/>
                </button>
                <button onClick={() => deleteProduct.mutate(p.id)} className="w-7 h-7 rounded-lg flex items-center justify-center transition"
                  style={{ color: '#9ca3af', background: '#f9fafb' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.background = '#fef2f2' }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.background = '#f9fafb' }}>
                  <Trash2 size={14}/>
                </button>
              </div>
            </div>
          ))
        ) : (
          categories?.map(c => (
            <div key={c.id} className="flex items-center gap-4 px-4 py-3 rounded-xl"
              style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}>
              <p className="flex-1 font-semibold text-sm" style={{ color: '#111827' }}>{c.name}</p>
              <p className="text-xs" style={{ color: '#9ca3af' }}>Orden: {c.sort_order}</p>
              <button onClick={() => openEditCategory(c)} className="w-7 h-7 rounded-lg flex items-center justify-center transition"
                style={{ color: '#9ca3af', background: '#f9fafb' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#111827')}
                onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}>
                <Pencil size={14}/>
              </button>
            </div>
          ))
        )}
      </div>

      {/* Product modal */}
      {showProductModal && (
        <Modal title={editingProduct ? 'Editar producto' : 'Nuevo producto'} onClose={() => setShowProductModal(false)}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: '#6b7280' }}>Categoría</label>
              <select value={productForm.category_id} onChange={e => setProductForm(f => ({ ...f, category_id: e.target.value }))}
                style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#111827')}
                onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')}>
                <option value="">Seleccionar...</option>
                {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {[
              { key: 'name',        label: 'Nombre',              placeholder: 'Taco de Birria' },
              { key: 'description', label: 'Descripción',         placeholder: 'Descripción del producto' },
              { key: 'price_mxn',   label: 'Precio MXN',          placeholder: '35.00' },
              { key: 'price_usd',   label: 'Precio USD (opcional)', placeholder: '1.75' },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#6b7280' }}>{label}</label>
                <input value={productForm[key as keyof typeof productForm]}
                  onChange={e => setProductForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder} style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#111827')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')} />
              </div>
            ))}
            <button onClick={() => saveProduct.mutate()}
              disabled={!productForm.name || !productForm.price_mxn || !productForm.category_id || saveProduct.isPending}
              className="w-full text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-40"
              style={{ background: '#111827' }}>
              <Check size={15}/> {saveProduct.isPending ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </Modal>
      )}

      {/* Category modal */}
      {showCategoryModal && (
        <Modal title={editingCategory ? 'Editar categoría' : 'Nueva categoría'} onClose={() => setShowCategoryModal(false)}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: '#6b7280' }}>Nombre</label>
              <input value={categoryForm.name} onChange={e => setCategoryForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ej: Entradas" style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#111827')}
                onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: '#6b7280' }}>Orden de aparición</label>
              <input type="number" value={categoryForm.sort_order} onChange={e => setCategoryForm(f => ({ ...f, sort_order: e.target.value }))}
                style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#111827')}
                onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')} />
            </div>
            <button onClick={() => saveCategory.mutate()} disabled={!categoryForm.name || saveCategory.isPending}
              className="w-full text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-40"
              style={{ background: '#111827' }}>
              <Check size={15}/> {saveCategory.isPending ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
