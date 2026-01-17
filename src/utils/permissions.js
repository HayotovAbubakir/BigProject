export const isDeveloper = (user) => {
  return !!user && user.role === 'developer'
}

export const isAdmin = (user) => {
  return !!user && user.role === 'admin'
}

export const hasPermission = (user, perm) => {
  if (!perm) return false
  if (!user) return false
  // Developer and admin accounts should NEVER have new_account_restriction
  if (perm === 'new_account_restriction') {
    if (isDeveloper(user) || isAdmin(user)) {
      return false  // Admins/developers are never restricted
    }
    // Regular users check their individual permissions
    if (user.role === 'user') {
      const p = user.permissions || {}
      return !!p[perm]
    }
    return false
  }
  // For other permissions: Developer and admin have full access
  if (isDeveloper(user)) return true
  if (isAdmin(user)) return true
  // Regular users check their individual permissions from the permissions object
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
