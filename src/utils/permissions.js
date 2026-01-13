export const isDeveloper = (user) => {
  return !!user && user.role === 'developer'
}

export const isAdmin = (user) => {
  return !!user && user.role === 'admin'
}

export const hasPermission = (user, perm) => {
  if (!perm) return false
  if (!user) return false
  if (isDeveloper(user)) return true
  if (isAdmin(user)) return true // admins have no restrictions by default
  if (user.role === 'user') {
    const p = user.permissions || {}
    return !!p[perm]
  }
  return false
}

// Can currentUser perform account-management actions on targetRole/targetUsername
export const canModifyAccount = (currentUser, targetRole, targetUsername) => {
  if (isDeveloper(currentUser)) return true
  if (!currentUser) return false
  // Admins may only manage ordinary users
  if (isAdmin(currentUser)) {
    if (!targetRole) return true // optimistic allow when unknown
    if (targetRole === 'user') return true
    return false
  }
  // Regular users cannot manage accounts
  return false
}

export default { isDeveloper, isAdmin, hasPermission, canModifyAccount }
