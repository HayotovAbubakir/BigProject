// Firebase removed — provide SQL-backed helper using sqlStorage
import sql from '../utils/sqlStorage'

export default null

export async function loadAppState(username) {
  try {
    if (username) {
      const key = `shop_state_user_${username}`
      const raw = await sql.sqlGet(key)
      if (raw) return JSON.parse(raw)
    }
    const backup = await sql.sqlGet('shop_state_backup_v1')
    if (backup) return JSON.parse(backup)
    return null
  } catch (err) {
    console.warn('loadAppState (sql fallback): failed to parse stored state', err)
    return null
  }
}

export async function saveAppState(state, username) {
  try {
    const userKey = username ? `shop_state_user_${username}` : null
    const payload = JSON.stringify(state)
    if (userKey) await sql.sqlSet(userKey, payload)
    await sql.sqlSet('shop_state_backup_v1', payload)
    return true
  } catch (err) {
    console.error('saveAppState (sql fallback): failed to write state', err)
    return false
  }
}
