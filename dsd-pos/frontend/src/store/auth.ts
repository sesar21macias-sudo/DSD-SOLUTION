import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: string
  email: string
  fullName: string
  role: string
  tenantId: string
}

interface AuthState {
  user: User | null
  token: string | null
  setAuth: (user: User, token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      setAuth: (user, token) => {
        localStorage.setItem('pos_token', token)
        set({ user, token })
      },
      logout: () => {
        localStorage.removeItem('pos_token')
        set({ user: null, token: null })
      },
    }),
    { name: 'pos-auth' }
  )
)
