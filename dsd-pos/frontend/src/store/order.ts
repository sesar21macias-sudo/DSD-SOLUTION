import { create } from 'zustand'

export interface CartItem {
  product_id: string
  name: string
  price: number
  quantity: number
  notes?: string
}

interface OrderState {
  items: CartItem[]
  tableId: string | null
  orderType: 'dine_in' | 'takeout' | 'delivery'
  currency: 'MXN' | 'USD'
  addItem: (item: Omit<CartItem, 'quantity'>) => void
  removeItem: (product_id: string) => void
  updateQty: (product_id: string, qty: number) => void
  setTable: (id: string | null) => void
  setOrderType: (type: 'dine_in' | 'takeout' | 'delivery') => void
  setCurrency: (c: 'MXN' | 'USD') => void
  clear: () => void
  total: () => number
}

export const useOrderStore = create<OrderState>((set, get) => ({
  items: [],
  tableId: null,
  orderType: 'dine_in',
  currency: 'MXN',

  addItem: (item) => set((s) => {
    const existing = s.items.find(i => i.product_id === item.product_id)
    if (existing) {
      return { items: s.items.map(i => i.product_id === item.product_id ? { ...i, quantity: i.quantity + 1 } : i) }
    }
    return { items: [...s.items, { ...item, quantity: 1 }] }
  }),

  removeItem: (id) => set((s) => ({ items: s.items.filter(i => i.product_id !== id) })),

  updateQty: (id, qty) => set((s) => ({
    items: qty <= 0
      ? s.items.filter(i => i.product_id !== id)
      : s.items.map(i => i.product_id === id ? { ...i, quantity: qty } : i)
  })),

  setTable: (id) => set({ tableId: id }),
  setOrderType: (type) => set({ orderType: type }),
  setCurrency: (c) => set({ currency: c }),
  clear: () => set({ items: [], tableId: null }),
  total: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
}))
