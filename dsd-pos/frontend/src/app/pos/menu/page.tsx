'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'
import { UtensilsCrossed, Plus, Pencil, Trash2, X, Check } from 'lucide-react'

interface Category { id: string; name: string; sort_order: number }
interface Product { id: string; name: string; description?: string; price_mxn: number; price_usd?: number; category_id: string; is_active: boolean; menu_categories?: { name: string } }

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="font-bold text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={18} /></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}

export default function MenuPage() {
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<'products' | 'categories'>('products')
  const [showProductModal, setShowProductModal] = useState(false)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)

  const [productForm, setProductForm] = useState({ name: '', description: '', price_mxn: '', price_usd: '', category_id: '' })
  const [categoryForm, setCategoryForm] = useState({ name: '', sort_order: '0' })

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
      const payload = {
        name: productForm.name,
        description: productForm.description,
        price_mxn: parseFloat(productForm.price_mxn),
        price_usd: productForm.price_usd ? parseFloat(productForm.price_usd) : undefined,
        category_id: productForm.category_id,
      }
      if (editingProduct) return api.put(`/menu/products/${editingProduct.id}`, payload)
      return api.post('/menu/products', payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products-admin'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      toast.success(editingProduct ? 'Producto actualizado' : 'Producto creado')
      setShowProductModal(false)
      setEditingProduct(null)
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
      if (editingCategory) return api.put(`/menu/categories/${editingCategory.id}`, payload)
      return api.post('/menu/categories', payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] })
      toast.success(editingCategory ? 'Categoría actualizada' : 'Categoría creada')
      setShowCategoryModal(false)
      setEditingCategory(null)
      setCategoryForm({ name: '', sort_order: '0' })
    },
  })

  function openEditProduct(p: Product) {
    setEditingProduct(p)
    setProductForm({ name: p.name, description: p.description ?? '', price_mxn: String(p.price_mxn), price_usd: String(p.price_usd ?? ''), category_id: p.category_id })
    setShowProductModal(true)
  }

  function openEditCategory(c: Category) {
    setEditingCategory(c)
    setCategoryForm({ name: c.name, sort_order: String(c.sort_order) })
    setShowCategoryModal(true)
  }

  return (
    <div className="h-full flex flex-col">
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center gap-3">
        <UtensilsCrossed className="text-orange-400" size={20} />
        <h1 className="text-lg font-bold text-white">Gestión de Menú</h1>
        <div className="flex gap-2 ml-auto">
          <button
            onClick={() => { setActiveTab('products'); setShowProductModal(true); setEditingProduct(null); setProductForm({ name: '', description: '', price_mxn: '', price_usd: '', category_id: categories?.[0]?.id ?? '' }) }}
            className="bg-orange-500 hover:bg-orange-600 text-white text-sm px-3 py-1.5 rounded-lg flex items-center gap-1 transition"
          >
            <Plus size={14} /> Producto
          </button>
          <button
            onClick={() => { setActiveTab('categories'); setShowCategoryModal(true); setEditingCategory(null); setCategoryForm({ name: '', sort_order: '0' }) }}
            className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-3 py-1.5 rounded-lg flex items-center gap-1 transition"
          >
            <Plus size={14} /> Categoría
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 flex gap-4">
        {(['products', 'categories'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`py-3 text-sm font-medium border-b-2 transition ${activeTab === tab ? 'border-orange-500 text-orange-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
          >
            {tab === 'products' ? 'Productos' : 'Categorías'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'products' ? (
          <div className="space-y-2">
            {products?.map(p => (
              <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm">{p.name}</p>
                  <p className="text-xs text-gray-500">{p.menu_categories?.name} · {p.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-orange-400 font-bold text-sm">${Number(p.price_mxn).toFixed(2)}</p>
                  {p.price_usd && <p className="text-xs text-gray-500">USD {Number(p.price_usd).toFixed(2)}</p>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEditProduct(p)} className="text-gray-400 hover:text-white transition"><Pencil size={15} /></button>
                  <button onClick={() => deleteProduct.mutate(p.id)} className="text-gray-400 hover:text-red-400 transition"><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {categories?.map(c => (
              <div key={c.id} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-center gap-4">
                <p className="flex-1 font-semibold text-white text-sm">{c.name}</p>
                <p className="text-xs text-gray-500">Orden: {c.sort_order}</p>
                <button onClick={() => openEditCategory(c)} className="text-gray-400 hover:text-white transition"><Pencil size={15} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Product Modal */}
      {showProductModal && (
        <Modal title={editingProduct ? 'Editar producto' : 'Nuevo producto'} onClose={() => setShowProductModal(false)}>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Categoría</label>
              <select value={productForm.category_id} onChange={e => setProductForm(f => ({ ...f, category_id: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500">
                <option value="">Seleccionar...</option>
                {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {[
              { key: 'name', label: 'Nombre', placeholder: 'Taco de Birria' },
              { key: 'description', label: 'Descripción', placeholder: 'Descripción del producto' },
              { key: 'price_mxn', label: 'Precio MXN', placeholder: '35.00' },
              { key: 'price_usd', label: 'Precio USD (opcional)', placeholder: '1.75' },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="text-xs text-gray-400 mb-1 block">{label}</label>
                <input
                  value={productForm[key as keyof typeof productForm]}
                  onChange={e => setProductForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
                />
              </div>
            ))}
            <button
              onClick={() => saveProduct.mutate()}
              disabled={!productForm.name || !productForm.price_mxn || !productForm.category_id || saveProduct.isPending}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-semibold py-2 rounded-lg flex items-center justify-center gap-2 transition"
            >
              <Check size={15} /> {saveProduct.isPending ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </Modal>
      )}

      {/* Category Modal */}
      {showCategoryModal && (
        <Modal title={editingCategory ? 'Editar categoría' : 'Nueva categoría'} onClose={() => setShowCategoryModal(false)}>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Nombre</label>
              <input value={categoryForm.name} onChange={e => setCategoryForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ej: Entradas" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Orden de aparición</label>
              <input type="number" value={categoryForm.sort_order} onChange={e => setCategoryForm(f => ({ ...f, sort_order: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
            </div>
            <button onClick={() => saveCategory.mutate()} disabled={!categoryForm.name || saveCategory.isPending}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-semibold py-2 rounded-lg flex items-center justify-center gap-2 transition">
              <Check size={15} /> {saveCategory.isPending ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
