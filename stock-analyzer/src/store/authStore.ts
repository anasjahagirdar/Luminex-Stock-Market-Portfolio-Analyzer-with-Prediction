import { create } from 'zustand'
import { loginUser, registerUser } from '../api'

interface AuthUser {
  user_id: number
  username: string
  access_token: string
}

interface AuthStore {
  user: AuthUser | null
  isLoading: boolean
  error: string | null
  login: (username: string, password: string) => Promise<boolean>
  register: (username: string, email: string, password: string, security_question: string, security_answer: string) => Promise<boolean>
  logout: () => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: (() => {
    const token = localStorage.getItem('luminex_token')
    const username = localStorage.getItem('luminex_username')
    const user_id = localStorage.getItem('luminex_user_id')
    if (token && username && user_id) {
      return { user_id: parseInt(user_id), username, access_token: token }
    }
    return null
  })(),
  isLoading: false,
  error: null,

  login: async (username, password) => {
    set({ isLoading: true, error: null })
    try {
      const data = await loginUser(username, password)
      localStorage.setItem('luminex_token', data.access_token)
      localStorage.setItem('luminex_username', data.username)
      localStorage.setItem('luminex_user_id', String(data.user_id))
      set({
        user: {
          user_id: data.user_id,
          username: data.username,
          access_token: data.access_token,
        },
        isLoading: false,
        error: null,
      })
      return true
    } catch (err: any) {
      set({
        error: err.response?.data?.detail ?? 'Login failed',
        isLoading: false,
      })
      return false
    }
  },

  register: async (username, email, password, security_question, security_answer) => {
    set({ isLoading: true, error: null })
    try {
      const data = await registerUser(username, email, password, security_question, security_answer)
      localStorage.setItem('luminex_token', data.access_token)
      localStorage.setItem('luminex_username', data.username)
      localStorage.setItem('luminex_user_id', String(data.user_id))
      set({
        user: {
          user_id: data.user_id,
          username: data.username,
          access_token: data.access_token,
        },
        isLoading: false,
        error: null,
      })
      return true
    } catch (err: any) {
      set({
        error: err.response?.data?.detail ?? 'Registration failed',
        isLoading: false,
      })
      return false
    }
  },

  logout: () => {
    localStorage.removeItem('luminex_token')
    localStorage.removeItem('luminex_username')
    localStorage.removeItem('luminex_user_id')
    set({ user: null, error: null })
  },
}))