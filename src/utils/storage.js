import sql from './sqlStorage'

// Keys used by the legacy storage
const LEGACY_BACKUP = 'shop_state_backup_v1'
const LEGACY_CREDENTIALS = 'app_credentials_v1'
const SHARED_STATE_KEY = 'app_state_shared_v1'  // Single shared key for all accounts

async function migrateIfNeeded() {
  // If legacy localStorage keys exist and SQL doesn't have them yet, migrate.
  try {
    // Collect keys from localStorage reliably
    const allKeys = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k) allKeys.push(k)
    }
    const legacyKeys = allKeys.filter(k => k.startsWith('shop_state_user_') || k === LEGACY_BACKUP || k === LEGACY_CREDENTIALS)
    if (!legacyKeys.length) return

    // Ensure SQL DB ready
    await sql.initSql()

    // Keep a backup inside SQL and write legacy keys into SQL kv
    const backupSnapshot = {}
    let stateToMigrate = null
    for (const k of legacyKeys) {
      const val = localStorage.getItem(k)
      backupSnapshot[k] = val
      // write into SQL kv
      await sql.sqlSet(k, val)
      // Capture first found state to migrate to shared key
      if (!stateToMigrate && (k.startsWith('shop_state_user_') || k === LEGACY_BACKUP)) {
        stateToMigrate = val
      }
    }
    // If we found a state, migrate it to the shared key
    if (stateToMigrate) {
      await sql.sqlSet(SHARED_STATE_KEY, stateToMigrate)
    }
    // store a JSON backup inside SQL as well
    await sql.sqlSet('legacy_shop_state_backup_snapshot_v1', JSON.stringify(backupSnapshot))
    // Remove legacy keys from localStorage (we migrated them)
    for (const k of legacyKeys) localStorage.removeItem(k)
  } catch (err) {
    console.warn('migrateIfNeeded failed', err)
  }
}

export async function loadAppState(username) {
  try {
    await migrateIfNeeded()
    // Load from shared state key (same for all accounts)
    const raw = await sql.sqlGet(SHARED_STATE_KEY)
    if (raw) return JSON.parse(raw)
    
    // Fallback to legacy backup
    const backup = await sql.sqlGet(LEGACY_BACKUP)
    if (backup) return JSON.parse(backup)
    return null
  } catch (err) {
    console.warn('loadAppState: failed to parse stored state', err)
    return null
  }
}

export async function saveAppState(state, username) {
  try {
    const payload = JSON.stringify(state)
    // Save to shared state key (same for all accounts)
    await sql.sqlSet(SHARED_STATE_KEY, payload)
    // Also update legacy backup for compatibility
    await sql.sqlSet(LEGACY_BACKUP, payload)
    return true
  } catch (err) {
    console.error('saveAppState: failed to write state', err)
    return false
  }
}

export async function clearAppState(username) {
  try {
    // Clear shared state
    await sql.sqlDelete(SHARED_STATE_KEY)
    await sql.sqlDelete(LEGACY_BACKUP)
    return true
  } catch (err) {
    console.warn('clearAppState failed', err)
    return false
  }
}
