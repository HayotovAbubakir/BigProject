import React from 'react'
import { supabase } from '/supabase/supabaseClient'
import { isDeveloper, isAdmin, hasPermission } from '../utils/permissions'

const AuthContext = React.createContext(null)

const AUTH_TIMEOUT_MS = 1000 * 60 * 60 // 1 hour
const SESSION_START_KEY = 'bigproject_auth_started_at'
const AUTH_DOMAIN = import.meta.env.VITE_SUPABASE_AUTH_DOMAIN || 'app.local'
const ALLOW_LEGACY = import.meta.env.VITE_ALLOW_LEGACY === 'true'
const LEGACY_USER_KEY = 'bigproject_legacy_user'
const LEGACY_FALLBACK_KEY = 'currentUser'

const normalizeUsername = (value) => (value || '').toString().trim().toLowerCase()
const usernameToEmail = (username) => {
  const normalized = normalizeUsername(username)
  if (!normalized) return ''
  return normalized.includes('@') ? normalized : `${normalized}@${AUTH_DOMAIN}`
}

const passwordPolicy = {
  minLength: 10,
  requireUpper: true,
  requireLower: true,
  requireNumber: true,
  requireSymbol: true
}

const validatePassword = (password) => {
  const value = (password || '').toString()
  const errors = []
  if (value.length < passwordPolicy.minLength) {
    errors.push(`Password must be at least ${passwordPolicy.minLength} characters`)
  }
  if (passwordPolicy.requireUpper && !/[A-Z]/.test(value)) errors.push('Password must include an uppercase letter')
  if (passwordPolicy.requireLower && !/[a-z]/.test(value)) errors.push('Password must include a lowercase letter')
  if (passwordPolicy.requireNumber && !/[0-9]/.test(value)) errors.push('Password must include a number')
  if (passwordPolicy.requireSymbol && !/[^A-Za-z0-9]/.test(value)) errors.push('Password must include a symbol')
  return { ok: errors.length === 0, errors }
}

const readSessionStart = () => {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(SESSION_START_KEY)
    const ts = raw ? Number(raw) : null
    return Number.isFinite(ts) ? ts : null
  } catch (_err) {
    return null
  }
}

const writeSessionStart = (ts) => {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(SESSION_START_KEY, String(ts))
  } catch (_err) {
    void _err
  }
}

const clearSessionStart = () => {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(SESSION_START_KEY)
  } catch (_err) {
    void _err
  }
}

const readLegacyUser = () => {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(LEGACY_USER_KEY) || localStorage.getItem(LEGACY_FALLBACK_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch (_err) {
    return null
  }
}

const writeLegacyUser = (payload) => {
  if (typeof window === 'undefined') return
  try {
    const encoded = JSON.stringify(payload)
    localStorage.setItem(LEGACY_USER_KEY, encoded)
    localStorage.setItem(LEGACY_FALLBACK_KEY, encoded)
  } catch (_err) {
    void _err
  }
}

const clearLegacyUser = () => {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(LEGACY_USER_KEY)
    localStorage.removeItem(LEGACY_FALLBACK_KEY)
  } catch (_err) {
    void _err
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = React.useState(null)
  const [authUser, setAuthUser] = React.useState(null)
  const [session, setSession] = React.useState(null)
  const [showLogin, setShowLogin] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [authNotice, setAuthNotice] = React.useState('')
  const [legacyMode, setLegacyMode] = React.useState(false)
  const legacyModeRef = React.useRef(false)

  const setLegacyActive = React.useCallback((active) => {
    legacyModeRef.current = active
    setLegacyMode(active)
  }, [])

  const applyLegacyUser = React.useCallback((legacyUser) => {
    if (!legacyUser) return
    const role = legacyUser.role || 'user'
    let permissions = (role === 'user' || role === 'admin') ? (legacyUser.permissions || {}) : {}
    if (role === 'developer') {
      permissions = { ...permissions, new_account_restriction: false }
    }
    setSession(null)
    setAuthUser(null)
    setLegacyActive(true)
    setUser({
      username: legacyUser.username,
      role,
      permissions,
      balance_uzs: legacyUser.balance_uzs,
      balance_usd: legacyUser.balance_usd
    })
    setAuthNotice('Legacy login is active. Deploy Supabase Auth for full security.')
    setShowLogin(false)
  }, [setLegacyActive])

  const loadProfile = React.useCallback(async (sessionUser) => {
    if (!sessionUser?.id) return null

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, username, role, permissions, balance_uzs, balance_usd, mfa_enabled')
        .eq('id', sessionUser.id)
        .maybeSingle()

      if (error) {
        console.warn('Failed to load user profile:', error)
        return null
      }

      if (data) return data

      const fallbackUsername = normalizeUsername(sessionUser.email ? sessionUser.email.split('@')[0] : sessionUser.id.slice(0, 8))
      const { data: created, error: createErr } = await supabase
        .from('user_profiles')
        .insert({ id: sessionUser.id, username: fallbackUsername, role: 'user', permissions: {} })
        .select('id, username, role, permissions, balance_uzs, balance_usd, mfa_enabled')
        .single()

      if (createErr) {
        console.warn('Failed to create missing profile:', createErr)
        return null
      }
      return created
    } catch (err) {
      console.warn('Profile load failed:', err)
      return null
    }
  }, [])

  const applySession = React.useCallback(async (nextSession) => {
    setSession(nextSession)
    setAuthUser(nextSession?.user || null)
    if (!nextSession) {
      if (legacyModeRef.current) {
        setShowLogin(false)
        return
      }
      setUser(null)
      setShowLogin(true)
      return
    }
    setAuthNotice('')
    setLegacyActive(false)
    clearLegacyUser()

    const profile = await loadProfile(nextSession.user)
    if (profile) {
      const role = profile.role || 'user'
      let permissions = (role === 'user' || role === 'admin') ? (profile.permissions || {}) : {}
      if (role === 'developer') {
        permissions = { ...permissions, new_account_restriction: false }
      }
      setUser({
        username: profile.username,
        role,
        permissions,
        balance_uzs: profile.balance_uzs,
        balance_usd: profile.balance_usd,
        mfa_enabled: profile.mfa_enabled
      })
    } else {
      setUser(null)
    }
    setShowLogin(false)
  }, [loadProfile, setLegacyActive])

  React.useEffect(() => {
    let mounted = true
    const init = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (!mounted) return
        if (error) {
          console.warn('Auth session load error:', error)
        }
        const existingSession = data?.session || null
        await applySession(existingSession)

        if (existingSession) {
          const startedAt = readSessionStart()
          const now = Date.now()
          if (!startedAt) {
            writeSessionStart(now)
          } else if (now - startedAt > AUTH_TIMEOUT_MS) {
            await logout('expired')
          }
        } else if (ALLOW_LEGACY) {
          const legacy = readLegacyUser()
          if (legacy && legacy.username) {
            const startedAt = readSessionStart()
            const now = Date.now()
            if (!startedAt) {
              writeSessionStart(now)
              applyLegacyUser(legacy)
            } else if (now - startedAt > AUTH_TIMEOUT_MS) {
              clearLegacyUser()
              setLegacyActive(false)
              setAuthNotice('Session expired. Please sign in again.')
              setShowLogin(true)
            } else {
              applyLegacyUser(legacy)
            }
          }
        }
      } catch (err) {
        console.error('Auth init failed:', err)
        setShowLogin(true)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    init()

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (!mounted) return
      if (event === 'SIGNED_IN') {
        writeSessionStart(Date.now())
      }
      if (event === 'SIGNED_OUT') {
        clearSessionStart()
      }
      await applySession(nextSession)
    })

    return () => {
      mounted = false
      authListener?.subscription?.unsubscribe?.()
    }
  }, [applySession, applyLegacyUser, setLegacyActive])

  React.useEffect(() => {
    if (!session) return
    const startedAt = readSessionStart() || Date.now()
    writeSessionStart(startedAt)

    const timeoutMs = Math.max(0, AUTH_TIMEOUT_MS - (Date.now() - startedAt))
    const timeoutId = setTimeout(() => {
      logout('expired')
    }, timeoutMs)

    return () => clearTimeout(timeoutId)
  }, [session])

  React.useEffect(() => {
    if (session || !legacyMode) return
    const startedAt = readSessionStart() || Date.now()
    writeSessionStart(startedAt)
    const timeoutMs = Math.max(0, AUTH_TIMEOUT_MS - (Date.now() - startedAt))
    const timeoutId = setTimeout(() => {
      logout('expired')
    }, timeoutMs)
    return () => clearTimeout(timeoutId)
  }, [legacyMode, session])

  const login = async (payload = {}, options = {}) => {
    const { username, password, captchaToken, mode } = payload || {}
    const { silent = false } = options
    setLoading(true)
    setAuthNotice('')

    try {
      const normalizedUsername = normalizeUsername(username)
      const normalizedPassword = (password || '').toString()

      if (!normalizedUsername || !normalizedPassword) {
        setLoading(false)
        return { ok: false, error: 'Username and password are required' }
      }

      let responseData = null
      try {
        const { data, error } = await supabase.functions.invoke('auth-login', {
          body: {
            username: normalizedUsername,
            password: normalizedPassword,
            captchaToken: captchaToken || null,
            mode: mode || 'login'
          }
        })
        if (error) throw error
        responseData = data
      } catch (fnErr) {
        if (!ALLOW_LEGACY) throw fnErr
        // Legacy fallback (not recommended): try Supabase Auth, then legacy table
        const email = usernameToEmail(normalizedUsername)
        const { data, error } = await supabase.auth.signInWithPassword({ email, password: normalizedPassword })
        if (!error && data?.session) {
          writeSessionStart(Date.now())
          setLoading(false)
          if (!silent) setShowLogin(false)
          return { ok: true }
        }

        try {
          const { data: legacy, error: legacyErr } = await supabase
            .from('user_credentials')
            .select('username, role, permissions, balance_uzs, balance_usd, password_hash')
            .eq('username', normalizedUsername)
            .maybeSingle()

          if (legacyErr || !legacy) {
            setLoading(false)
            return { ok: false, error: 'Invalid username or password' }
          }

          if (legacy.password_hash !== normalizedPassword) {
            setLoading(false)
            return { ok: false, error: 'Invalid username or password' }
          }

          const legacyUser = {
            username: legacy.username,
            role: legacy.role || 'user',
            permissions: legacy.permissions || {},
            balance_uzs: legacy.balance_uzs,
            balance_usd: legacy.balance_usd
          }
          writeLegacyUser(legacyUser)
          writeSessionStart(Date.now())
          applyLegacyUser(legacyUser)
          setLoading(false)
          return { ok: true, legacy: true }
        } catch (legacyCatch) {
          console.warn('Legacy auth fallback failed:', legacyCatch)
          setLoading(false)
          return { ok: false, error: 'Invalid username or password' }
        }
      }

      if (!responseData || responseData.ok === false) {
        setLoading(false)
        return {
          ok: false,
          error: responseData?.error || 'Invalid username or password',
          lockUntil: responseData?.lockUntil || null,
          retryAfterSeconds: responseData?.retryAfterSeconds || null,
          challengeRequired: !!responseData?.challengeRequired
        }
      }

      const sessionPayload = responseData.session || {}
      if (!sessionPayload.access_token || !sessionPayload.refresh_token) {
        setLoading(false)
        return { ok: false, error: 'Authentication response missing tokens' }
      }

      const { error: setErr } = await supabase.auth.setSession({
        access_token: sessionPayload.access_token,
        refresh_token: sessionPayload.refresh_token
      })

      if (setErr) {
        setLoading(false)
        return { ok: false, error: setErr.message }
      }

      writeSessionStart(Date.now())
      setLoading(false)
      if (!silent) setShowLogin(false)
      return { ok: true }
    } catch (err) {
      console.error('Login failed:', err)
      setLoading(false)
      return { ok: false, error: 'Login failed' }
    }
  }

  const logout = async (reason) => {
    try {
      await supabase.auth.signOut()
    } catch (_err) {
      void _err
    }
    clearSessionStart()
    clearLegacyUser()
    setLegacyActive(false)
    setSession(null)
    setAuthUser(null)
    setUser(null)
    setShowLogin(true)
    if (reason === 'expired') {
      setAuthNotice('Session expired. Please sign in again.')
    }
  }

  const confirmPassword = async (password, captchaToken) => {
    const target = user?.username
    if (!target) return { ok: false, error: 'Not authenticated' }
    if (legacyModeRef.current && ALLOW_LEGACY) {
      try {
        const { data: legacy, error } = await supabase
          .from('user_credentials')
          .select('password_hash')
          .eq('username', normalizeUsername(target))
          .maybeSingle()
        if (error || !legacy) return { ok: false, error: 'Invalid password' }
        if (legacy.password_hash !== (password || '').toString()) return { ok: false, error: 'Invalid password' }
        return { ok: true }
      } catch (err) {
        return { ok: false, error: 'Invalid password' }
      }
    }
    return login({ username: target, password, captchaToken, mode: 'reauth' }, { silent: true })
  }

  const signUp = async (payload = {}) => {
    const { username, password } = payload || {}
    const normalizedUsername = normalizeUsername(username)
    const normalizedPassword = (password || '').toString()

    const policy = validatePassword(normalizedPassword)
    if (!policy.ok) {
      return { ok: false, error: policy.errors.join('. ') }
    }

    try {
      const email = usernameToEmail(normalizedUsername)
      const { data, error } = await supabase.auth.signUp({ email, password: normalizedPassword })
      if (error) return { ok: false, error: error.message }

      if (data?.user?.id) {
        await supabase.from('user_profiles').insert({
          id: data.user.id,
          username: normalizedUsername,
          role: 'user',
          permissions: {},
          created_by: data.user.id
        })
      }

      return { ok: true }
    } catch (err) {
      console.error('Sign up failed:', err)
      return { ok: false, error: 'Sign up failed' }
    }
  }

  const registerUser = async (username, password, role = 'user', permissions = {}) => {
    const normalizedUsername = normalizeUsername(username)
    const normalizedPassword = (password || '').toString()

    const policy = validatePassword(normalizedPassword)
    if (!policy.ok) {
      return { ok: false, error: policy.errors.join('. ') }
    }

    try {
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          username: normalizedUsername,
          password: normalizedPassword,
          role,
          permissions
        }
      })
      if (error) return { ok: false, error: error.message || 'Failed to create user' }
      if (data?.ok === false) return { ok: false, error: data?.error || 'Failed to create user' }
      return { ok: true }
    } catch (err) {
      console.error('registerUser failed:', err)
      if (!ALLOW_LEGACY) return { ok: false, error: 'Failed to create user' }
      try {
        const { error: legacyErr } = await supabase
          .from('user_credentials')
          .insert({
            username: normalizedUsername,
            password_hash: normalizedPassword,
            role,
            permissions,
            created_by: user?.username || 'system'
          })
        if (legacyErr) return { ok: false, error: legacyErr.message || 'Failed to create user' }
        return { ok: true, legacy: true }
      } catch (legacyCatch) {
        return { ok: false, error: 'Failed to create user' }
      }
    }
  }

  const updateUser = async (username, updates) => {
    try {
      const normalizedUsername = normalizeUsername(username)
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('id, role')
        .eq('username', normalizedUsername)
        .single()

      if (error || !profile) return { success: false, error: error?.message || 'User not found' }

      const { data: updated, error: upErr } = await supabase
        .from('user_profiles')
        .update({ ...updates })
        .eq('id', profile.id)
        .select('*')
        .single()

      if (upErr) return { success: false, error: upErr.message }
      return { success: true, data: updated }
    } catch (err) {
      console.error('Update user failed:', err)
      return { success: false, error: err.message }
    }
  }

  const deleteUser = async (username) => {
    try {
      const normalizedUsername = normalizeUsername(username)
      const { data, error } = await supabase.functions.invoke('admin-delete-user', {
        body: { username: normalizedUsername }
      })
      if (error) return { success: false, error: error.message || 'Failed to delete user' }
      if (data?.ok === false) return { success: false, error: data?.error || 'Failed to delete user' }
      return { success: true, data }
    } catch (err) {
      console.error('Delete user failed:', err)
      if (!ALLOW_LEGACY) return { success: false, error: 'Failed to delete user' }
      try {
        const normalizedUsername = normalizeUsername(username)
        const { data, error } = await supabase
          .from('user_credentials')
          .delete()
          .eq('username', normalizedUsername)
          .select('*')
          .single()
        if (error) return { success: false, error: error.message || 'Failed to delete user' }
        return { success: true, data, legacy: true }
      } catch (_legacyErr) {
        return { success: false, error: 'Failed to delete user' }
      }
    }
  }

  const getUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, username, role, permissions, balance_uzs, balance_usd, created_at')
        .order('created_at', { ascending: true })

      if (error) return { success: false, error: error.message }
      return { success: true, users: data || [] }
    } catch (err) {
      console.error('Get users failed:', err)
      if (!ALLOW_LEGACY) return { success: false, error: err.message }
      try {
        const { data, error } = await supabase
          .from('user_credentials')
          .select('id, username, role, permissions, balance_uzs, balance_usd, created_at')
          .order('created_at', { ascending: true })
        if (error) return { success: false, error: error.message }
        return { success: true, users: data || [], legacy: true }
      } catch (legacyErr) {
        return { success: false, error: legacyErr.message }
      }
    }
  }

  const listMfaFactors = async () => {
    try {
      if (!supabase.auth?.mfa) return { ok: false, error: 'MFA not supported' }
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (error) return { ok: false, error: error.message }
      return { ok: true, data }
    } catch (err) {
      return { ok: false, error: err.message || 'MFA failed' }
    }
  }

  const enrollMfa = async () => {
    try {
      if (!supabase.auth?.mfa) return { ok: false, error: 'MFA not supported' }
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
      if (error) return { ok: false, error: error.message }
      return { ok: true, data }
    } catch (err) {
      return { ok: false, error: err.message || 'MFA enroll failed' }
    }
  }

  const challengeMfa = async (factorId) => {
    try {
      if (!supabase.auth?.mfa) return { ok: false, error: 'MFA not supported' }
      const { data, error } = await supabase.auth.mfa.challenge({ factorId })
      if (error) return { ok: false, error: error.message }
      return { ok: true, data }
    } catch (err) {
      return { ok: false, error: err.message || 'MFA challenge failed' }
    }
  }

  const verifyMfa = async (factorId, challengeId, code) => {
    try {
      if (!supabase.auth?.mfa) return { ok: false, error: 'MFA not supported' }
      const { data, error } = await supabase.auth.mfa.verify({ factorId, challengeId, code })
      if (error) return { ok: false, error: error.message }
      return { ok: true, data }
    } catch (err) {
      return { ok: false, error: err.message || 'MFA verify failed' }
    }
  }

  const value = {
    user,
    authUser,
    session,
    username: user?.username,
    login,
    logout,
    signUp,
    showLogin,
    setShowLogin,
    registerUser,
    loading,
    isAdmin: isAdmin(user),
    isDeveloper: isDeveloper(user),
    permissions: user?.permissions || {},
    authNotice,
    legacyMode,
    hasPermission: (perm) => {
      try {
        return hasPermission(user, perm)
      } catch (_e) {
        return false
      }
    },
    confirmPassword,
    updateUser,
    deleteUser,
    getUsers,
    listMfaFactors,
    enrollMfa,
    challengeMfa,
    verifyMfa
  }

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  )
}

export default AuthContext

export { AuthContext, validatePassword, passwordPolicy, normalizeUsername, usernameToEmail }
