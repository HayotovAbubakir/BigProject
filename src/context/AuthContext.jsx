import React from 'react'
import sql from '../utils/sqlStorage'

const AUTH_KEY = 'app_auth_v1'
const CREDENTIALS_KEY = 'app_credentials_v1'

const ALLOWED_USERS = {
  hamdamjon: '1010',
  habibjon: '0000',
  shogirt: '1200',
}
const HOUR_MS = 60 * 60 * 1000

const AuthContext = React.createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = React.useState(null)
  const [showLogin, setShowLogin] = React.useState(false)
  const [credentials, setCredentials] = React.useState(ALLOWED_USERS)

  // Load credentials from SQL storage (no localStorage)
  React.useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        await sql.initSql()
        const raw = await sql.sqlGet(CREDENTIALS_KEY)
        if (!mounted) return
        if (raw) {
          const parsed = JSON.parse(raw)
          setCredentials(prev => ({ ...prev, ...parsed }))
        }
      } catch (err) {
        console.warn('AuthProvider: failed to load credentials from SQL', err)
      }
    })()
    return () => { mounted = false }
  }, [])

  React.useEffect(() => {
    try {
      const raw = sessionStorage.getItem(AUTH_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && parsed.username && parsed.ts && Date.now() - parsed.ts < HOUR_MS && Object.prototype.hasOwnProperty.call(credentials, parsed.username)) {
          setUser({ username: parsed.username, ts: parsed.ts })
          setShowLogin(false)
          return
        }
      }
    } catch {}
    setShowLogin(true)
  }, [credentials])

  React.useEffect(() => {
    if (!user) return
    const remaining = HOUR_MS - (Date.now() - user.ts)
    const t = setTimeout(() => setShowLogin(true), remaining > 0 ? remaining : 0)
    return () => clearTimeout(t)
  }, [user])

  const login = ({ username, password }) => {
    const userKey = (username || '').toString()
    if (!Object.prototype.hasOwnProperty.call(credentials, userKey)) return { ok: false }
    if (String(password) !== String(credentials[userKey])) return { ok: false }
    const auth = { username: userKey, ts: Date.now() }
    try { sessionStorage.setItem(AUTH_KEY, JSON.stringify(auth)) } catch {}
    setUser(auth)
    setShowLogin(false)
    return { ok: true }
  }

  const registerUser = async (username, password) => {
    if (!username) return false
    const uname = username.toString()
    const pwd = String(password || '')
    try {
      await sql.initSql()
      const existingRaw = await sql.sqlGet(CREDENTIALS_KEY)
      const existing = existingRaw ? JSON.parse(existingRaw) : {}
      existing[uname] = pwd
      await sql.sqlSet(CREDENTIALS_KEY, JSON.stringify(existing))
      setCredentials(prev => ({ ...prev, [uname]: pwd }))
      return true
    } catch (err) {
      console.error('AuthProvider: registerUser failed', err)
      return false
    }
  }

  const logout = () => {
    try { sessionStorage.removeItem(AUTH_KEY) } catch {}
    setUser(null)
    setShowLogin(true)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, showLogin, setShowLogin, registerUser, credentials }}>{children}</AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

export default AuthContext
