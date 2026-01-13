// sqlStorage.js — Disabled
// This project has been migrated to Supabase-only persistence.
// IndexedDB/sql.js storage is intentionally disabled to enforce server-side storage.

function disabled() {
  console.warn('sqlStorage is disabled: browser IndexedDB persistence is forbidden. Use Supabase APIs instead.')
}

export async function sqlGet() { disabled(); return null }
export async function sqlSet() { disabled(); return false }
export async function sqlDelete() { disabled(); return false }
export async function sqlKeys() { disabled(); return [] }
export async function sqlExportBase64() { disabled(); return null }

export default { sqlGet, sqlSet, sqlDelete, sqlKeys, sqlExportBase64 }
