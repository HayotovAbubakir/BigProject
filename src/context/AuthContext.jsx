import React from 'react'
import { supabase } from '/supabase/supabaseClient'

const AuthContext = React.createContext(null)

const isSupabaseConfigured = () => {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_KEY
  return url && key && !url.includes('placeholder') && !key.includes('placeholder')
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = React.useState(null)
  const [showLogin, setShowLogin] = React.useState(false)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    // Check for stored auth session
    const checkAuth = () => {
      try {
        const stored = sessionStorage.getItem('app_auth_v1')
        if (stored) {
          const parsed = JSON.parse(stored)
          if (parsed && parsed.username && parsed.ts && Date.now() - parsed.ts < 24 * 60 * 60 * 1000) { // 24 hours
            setUser({ username: parsed.username, ts: parsed.ts })
            setShowLogin(false)
          } else {
            sessionStorage.removeItem('app_auth_v1')
            setShowLogin(true)
          }
        } else {
          setShowLogin(true)
        }
      } catch (err) {
        console.error('Auth check failed:', err)
        setShowLogin(true)
      }
      setLoading(false)
    }

    checkAuth()
  }, [])

  const login = async ({ username, password }) => {
    if (!isSupabaseConfigured()) {
      return { ok: false, error: 'Supabase not configured' }
    }
    setLoading(true)
    try {
      // Check credentials in Supabase
      const { data, error } = await supabase
        .from('user_credentials')
        .select('username, password_hash')
        .eq('username', username)
        .single()

      if (error || !data) {
        setLoading(false)
        return { ok: false, error: 'Foydalanuvchi nomi yoki parol xato' }
      }

      // Simple password check (in production, use proper hashing)
      if (data.password_hash !== password) {
        setLoading(false)
        return { ok: false, error: 'Foydalanuvchi nomi yoki parol xato' }
      }

      const auth = { username: data.username, ts: Date.now() }
      sessionStorage.setItem('app_auth_v1', JSON.stringify(auth))
      setUser(auth)
      setShowLogin(false)
      setLoading(false)
      return { ok: true }
    } catch (err) {
      console.error('Login failed:', err)
      setLoading(false)
      return { ok: false, error: 'Login xatosi' }
    }
  }

  const registerUser = async (username, password) => {
    if (!isSupabaseConfigured()) {
      return { ok: false, error: 'Supabase not configured' }
    }
    setLoading(true)
    try {
      const { error } = await supabase
        .from('user_credentials')
        .insert({
          username: username,
          password_hash: password, // In production, hash this
          created_by: user?.username || 'system'
        })

      if (error) {
        console.error('Register error:', error)
        setLoading(false)
        return { ok: false, error: error.message }
      }

      setLoading(false)
      return { ok: true }
    } catch (err) {
      console.error('Register failed:', err)
      setLoading(false)
      return { ok: false, error: 'Ro\'yxatdan o\'tish xatosi' }
    }
  }

  const logout = () => {
    sessionStorage.removeItem('app_auth_v1')
    setUser(null)
    setShowLogin(true)
  }

  const value = {
    user,
    username: user?.username,
    login,
    logout,
    showLogin,
    setShowLogin,
    registerUser,
    loading,
    isAdmin: user?.username === 'hamdamjon' || user?.username === 'habibjon'
  }

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  
  // Add username getter
  const username = ctx.user?.user_metadata?.username || null
  
  return { ...ctx, username }
}

export default AuthContext
