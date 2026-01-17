import React from 'react'
import { supabase } from '/supabase/supabaseClient'
import { loadAppState, saveAppState } from '../firebase/db'
import { isDeveloper, isAdmin, hasPermission, canModifyAccount } from '../utils/permissions'

const AuthContext = React.createContext(null)

const USERNAME_TO_EMAIL = {}

  const accounts = []

export const AuthProvider = ({ children }) => {
  const [user, setUser] = React.useState(null)
  const [showLogin, setShowLogin] = React.useState(false)
  const [loading, setLoading] = React.useState(true)

  const AUTH_TIMEOUT_MS = 1000 * 60 * 60 // 1 hour

  React.useEffect(() => {
    // Check for current user in localStorage
    const checkAuth = async () => {
      try {
        const storedUser = localStorage.getItem('currentUser')
        if (storedUser) {
          const userData = JSON.parse(storedUser)
          // Refresh role/permissions from server to avoid stale localStorage values
          try {
            const { data: fresh, error: freshErr } = await supabase.from('user_credentials').select('username, role, permissions').eq('username', userData.username).maybeSingle()
            if (!freshErr && fresh) {
              const role = fresh.role || userData.role || 'user'
              let permissions = role === 'user' ? (fresh.permissions || {}) : {}
              // Ensure admin and developer accounts are never restricted
              if (role === 'admin' || role === 'developer') {
                permissions = { new_account_restriction: false }
              }
              const merged = { username: (fresh.username || userData.username), role, permissions }
              setUser(merged)
              localStorage.setItem('currentUser', JSON.stringify(merged))
            } else {
              setUser(userData)
            }
          } catch (e) {
            console.warn('Failed to refresh user from user_credentials:', e)
            setUser(userData)
          }
          setShowLogin(false)
        } else {
          setShowLogin(true)
        }
      } catch (err) {
        console.error('Auth check failed:', err)
        setShowLogin(true)
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [])

  const login = async (payload = {}) => {
    const { username, password } = payload || {}
    setLoading(true)
    try {
      // Normalize username to lowercase
      const normalizedUsername = (username || '').toLowerCase().trim()
      const normalizedPassword = (password || '').trim()
      
      console.log('Attempting login for user:', normalizedUsername)
      console.log('Password length:', normalizedPassword.length)
      
      // Query by exact username (normalized)
      const { data, error } = await supabase
        .from('user_credentials')
        .select('*')
        .eq('username', normalizedUsername)
        .single()

      if (error) {
        // Check if it's a "not found" error (PGRST116)
        if (error.code === 'PGRST116') {
          console.warn('User not found in database:', normalizedUsername)
          setLoading(false)
          return { ok: false, error: 'Invalid username or password' }
        }
        console.error('Login query error:', error.message || error.code || JSON.stringify(error))
        setLoading(false)
        return { ok: false, error: 'Database error: ' + (error.message || error.code) }
      }

      if (!data) {
        console.warn('No user data returned for:', normalizedUsername)
        setLoading(false)
        return { ok: false, error: 'Invalid username or password' }
      }

      console.log('User found:', normalizedUsername, 'Role:', data.role)
      console.log('Stored password_hash length:', (data.password_hash || '').length)

      // Check password (direct string comparison)
      if (data.password_hash === normalizedPassword) {
        console.log('Password match! Logging in user:', normalizedUsername)
        const role = data.role || 'user'
        let permissions = role === 'user' ? (data.permissions || {}) : {}
        // Ensure admin and developer accounts are never restricted
        if (role === 'admin' || role === 'developer') {
          permissions = { new_account_restriction: false }
        }
        const userData = {
          username: data.username,
          role,
          permissions
        }
        localStorage.setItem('currentUser', JSON.stringify(userData))
        setUser(userData)
        setShowLogin(false)
        setLoading(false)
        return { ok: true }
      } else {
        console.warn('Password mismatch for user:', normalizedUsername)
        console.log('Expected password_hash:', data.password_hash)
        console.log('Provided password:', normalizedPassword)
        
        // Fallback: try Supabase Auth sign-in (in case account was created via Supabase Auth console)
        try {
          const email = username && username.includes('@') ? username : (username + '@example.com')
          if (supabase?.auth && typeof supabase.auth.signInWithPassword === 'function') {
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, normalizedPassword })
            if (!authError && authData?.user) {
              // Sync into user_credentials table for future local logins
              const syncUsername = username && username.includes('@') ? username.split('@')[0] : username
              // If a row already exists, preserve its role/permissions and only update password_hash
              try {
                const { data: existing } = await supabase.from('user_credentials').select('username, role, permissions').eq('username', syncUsername).maybeSingle()
                if (existing) {
                  await supabase.from('user_credentials').update({ password_hash: normalizedPassword }).eq('username', syncUsername).select('*').single()
                  const role = existing.role || 'user'
                  const userData = { username: syncUsername, role, permissions: role === 'user' ? (existing.permissions || {}) : {} }
                  localStorage.setItem('currentUser', JSON.stringify(userData))
                  setUser(userData)
                  setShowLogin(false)
                  setLoading(false)
                  return { ok: true }
                } else {
                  await supabase.from('user_credentials').insert({ username: syncUsername, password_hash: normalizedPassword, role: 'user', permissions: {}, created_by: 'auto-sync' })
                  const userData = { username: syncUsername, role: 'user', permissions: {} }
                  localStorage.setItem('currentUser', JSON.stringify(userData))
                  setUser(userData)
                  setShowLogin(false)
                  setLoading(false)
                  return { ok: true }
                }
              } catch (syncErr) {
                console.warn('Failed to sync external auth user into user_credentials:', syncErr)
              }
            }
          }
        } catch (e) {
          console.error('Auth fallback failed:', e)
        }

        setLoading(false)
        return { ok: false, error: 'Invalid credentials' }
      }
    } catch (err) {
      console.error('Login failed:', err)
      setLoading(false)
      return { ok: false, error: 'Login failed' }
    }
  }

  const signUp = async (payload = {}) => {
    const { username, password } = payload || {}
    setLoading(true)
    try {
      // If username contains @, use it as email, else map to @example.com
      const email = username.includes('@') ? username : (USERNAME_TO_EMAIL[username] || username + '@example.com')
      const { error } = await supabase.auth.signUp({
        email,
        password
      })

      if (error) {
        setLoading(false)
        return { ok: false, error: error.message }
      }

      // Also ensure a row exists in `user_credentials` so app-level login/permissions work
      try {
        const syncUsername = username && username.includes('@') ? username.split('@')[0] : username
        await supabase.from('user_credentials').upsert({ username: syncUsername, password_hash: password, role: 'user', permissions: {} , created_by: 'self-signup' })
      } catch (e) {
        console.warn('Failed to sync signup into user_credentials:', e)
      }

      setLoading(false)
      return { ok: true }
    } catch (err) {
      console.error('Sign up failed:', err)
      setLoading(false)
      return { ok: false, error: 'Ro\'yxatdan o\'tish xatosi' }
    }
  }

  const logout = async () => {
    localStorage.removeItem('currentUser')
    setUser(null)
    setShowLogin(true)
  }

  const registerUser = async (username, password, role = 'user', permissions = {}) => {
    // Called by admin UI: insert into user_credentials so login and restrictions work
    try {
      console.log('registerUser called for:', username, 'with role:', role)
      const res = await addUser(username, password, role, permissions)
      console.log('addUser result:', res)
      if (!res || !res.success) {
        const errorMsg = (res && res.error) || 'Unknown error'
        console.error('registerUser failed:', errorMsg)
        return { ok: false, error: errorMsg }
      }
      console.log('User registered successfully:', username)
      // Optionally create Supabase Auth user so fallback auth works (non-blocking)
      try {
        const email = username.includes('@') ? username : (username + '@example.com')
        if (supabase?.auth && typeof supabase.auth.signUp === 'function') {
          await supabase.auth.signUp({ email, password })
        }
      } catch (e) {
        console.debug('registerUser: supabase.auth.signUp non-fatal error', e)
      }
      return { ok: true }
    } catch (err) {
      console.error('registerUser failed:', err)
      return { ok: false, error: err && err.message }
    }
  }

  const verifyLocalPassword = (username, password) => {
    // Verify password for hamdamjon (1010) and habibjon (0000)
    const lowerUsername = (username || '').toString().toLowerCase()
    if (lowerUsername === 'hamdamjon' && password === '1010') return true
    if (lowerUsername === 'habibjon' && password === '0000') return true
    return false
  }

  const getPredefinedAccount = (username) => {
    return null // removed
  }

  const addUser = async (username, password, role = 'user', permissions = {}) => {
    try {
      // Normalize username to lowercase for consistency
      const normalizedUsername = (username || '').toLowerCase().trim()
      const normalizedPassword = (password || '').trim()
      
      if (!normalizedUsername) {
        console.warn('Empty username provided')
        return { success: false, error: 'Username cannot be empty' }
      }

      if (!normalizedPassword) {
        console.warn('Empty password provided')
        return { success: false, error: 'Password cannot be empty' }
      }

      console.log('addUser: Creating user', normalizedUsername, 'with role:', role, 'password length:', normalizedPassword.length)

      // Authorization: who can create what
      const caller = user
      if (!caller) {
        // allow self-signup only for regular users
        if (role !== 'user') {
          console.warn('Non-admin user trying to create admin/developer')
          return { success: false, error: 'Not authorized to create admin/developer' }
        }
      } else if (isDeveloper(caller)) {
        console.log('addUser: Developer creating user')
        // developer may create any account
      } else if (isAdmin(caller)) {
        console.log('addUser: Admin creating user')
        // admins may only create ordinary users
        if (role !== 'user') {
          console.warn('Admin trying to create non-user account')
          return { success: false, error: 'Admins may only create ordinary users' }
        }
      } else {
        console.warn('Unauthorized user trying to create account')
        return { success: false, error: 'Not authorized to create accounts' }
      }

      // Ensure permissions JSON is only stored for regular users
      const sanitizedPermissions = role === 'user' ? (permissions || {}) : {}

      console.log('Inserting into user_credentials:', { username: normalizedUsername, role, permissions: sanitizedPermissions })

      const { data, error } = await supabase
        .from('user_credentials')
        .insert({ username: normalizedUsername, password_hash: normalizedPassword, role, permissions: sanitizedPermissions, created_by: user?.username || 'system' })
        .select()

      if (error) {
        console.error('Add user error:', error.message || JSON.stringify(error))
        return { success: false, error: error.message || 'Failed to create user' }
      }

      console.log('User created successfully:', data)
      return { success: true, data }
    } catch (err) {
      console.error('Add user failed:', err)
      return { success: false, error: err.message }
    }
  }

  const updateUser = async (username, updates) => {
    try {
      // Fetch target role
      const { data: target, error: tErr } = await supabase.from('user_credentials').select('role, username').eq('username', username).single()
      if (tErr) return { success: false, error: tErr.message }
      const targetRole = target?.role || 'user'
      const caller = user

      // Authorization checks
      if (isDeveloper(caller)) {
        // Developer can modify anyone
      } else if (isAdmin(caller)) {
        // Admins cannot modify other admins or developer
        if (targetRole === 'admin' || targetRole === 'developer') {
          return { success: false, error: 'Admins cannot modify other admins or developer' }
        }
        // Admins may set permissions only for users; sanitize below
      } else {
        // regular users: only allow updating own password
        if (caller?.username !== username) return { success: false, error: 'Not authorized' }
        // allow only password change
        const allowed = Object.keys(updates).every(k => k === 'password_hash')
        if (!allowed) return { success: false, error: 'Users may only update their own password' }
      }

      // If updates include role/permissions, enforce rules
      if (updates.role && !isDeveloper(caller)) {
        // only developer can change roles
        return { success: false, error: 'Only developer can change roles' }
      }

      if (updates.permissions) {
        // Ensure permissions only applied to users
        if (targetRole !== 'user' && updates.role !== 'user') {
          return { success: false, error: 'Permissions may only be assigned to ordinary users' }
        }
      }

      // Sanitize: if resulting role is not 'user', clear permissions
      const resultingRole = updates.role || targetRole
      const sanitizedUpdates = { ...updates }
      if (resultingRole !== 'user') sanitizedUpdates.permissions = {}

      const { data, error } = await supabase
        .from('user_credentials')
        .update(sanitizedUpdates)
        .eq('username', username)
        .select('*')
        .single()

      if (error) {
        console.error('Update user error:', error)
        return { success: false, error: error.message }
      }

      return { success: true, data }
    } catch (err) {
      console.error('Update user failed:', err)
      return { success: false, error: err.message }
    }
  }

  const deleteUser = async (username) => {
    try {
      const { data: target, error: tErr } = await supabase.from('user_credentials').select('role, username').eq('username', username).single()
      if (tErr) return { success: false, error: tErr.message }
      const targetRole = target?.role || 'user'
      const caller = user

      if (isDeveloper(caller)) {
        // allowed
      } else if (isAdmin(caller)) {
        if (targetRole !== 'user') return { success: false, error: 'Admins may not delete other admins or developer' }
      } else {
        return { success: false, error: 'Not authorized' }
      }

      const { data, error } = await supabase
        .from('user_credentials')
        .delete()
        .eq('username', username)
        .select('*')
        .single()

      if (error) {
        console.error('Delete user error:', error)
        return { success: false, error: error.message }
      }

      return { success: true, data }
    } catch (err) {
      console.error('Delete user failed:', err)
      return { success: false, error: err.message }
    }
  }

  const getUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('user_credentials')
        .select('username, role, permissions, created_at')

      if (error) {
        console.error('Get users error:', error)
        return { success: false, error: error.message }
      }

      return { success: true, users: data }
    } catch (err) {
      console.error('Get users failed:', err)
      return { success: false, error: err.message }
    }
  }

  const value = {
    user,
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
    hasPermission: (perm) => {
      try {
        return hasPermission(user, perm)
      } catch (e) {
        return false
      }
    },
    verifyLocalPassword,
    getPredefinedAccount,
    addUser,
    updateUser,
    deleteUser,
    getUsers
  }

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  )
}

export default AuthContext

export { AuthContext }
