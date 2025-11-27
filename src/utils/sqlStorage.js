// sqlStorage.js — simple sql.js-based key/value storage for browser
// Stores the SQLite DB as raw bytes in IndexedDB under `sql_db_v1`.
// Uses sql.js to manage an in-memory SQLite DB and persists it to IndexedDB.

let SQL = null
let db = null
const DB_KEY = 'sql_db_v1'
const IDB_NAME = 'bigproject_sql_db'
const IDB_STORE = 'files'

function openIdb() {
  return new Promise((resolve, reject) => {
    const rq = indexedDB.open(IDB_NAME, 1)
    rq.onupgradeneeded = () => {
      const idb = rq.result
      if (!idb.objectStoreNames.contains(IDB_STORE)) idb.createObjectStore(IDB_STORE)
    }
    rq.onsuccess = () => resolve(rq.result)
    rq.onerror = () => reject(rq.error)
  })
}

async function idbGet(key) {
  const idb = await openIdb()
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readonly')
    const store = tx.objectStore(IDB_STORE)
    const rq = store.get(key)
    rq.onsuccess = () => resolve(rq.result || null)
    rq.onerror = () => reject(rq.error)
  })
}

async function idbSet(key, value) {
  const idb = await openIdb()
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite')
    const store = tx.objectStore(IDB_STORE)
    const rq = store.put(value, key)
    rq.onsuccess = () => resolve(true)
    rq.onerror = () => reject(rq.error)
  })
}

async function idbDelete(key) {
  const idb = await openIdb()
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite')
    const store = tx.objectStore(IDB_STORE)
    const rq = store.delete(key)
    rq.onsuccess = () => resolve(true)
    rq.onerror = () => reject(rq.error)
  })
}

async function initSql() {
  if (db) return db
  try {
    if (!SQL) {
      // Attempt dynamic module import first
      try {
        const mod = await import('https://unpkg.com/sql.js@1.9.0/dist/sql-wasm.js')
        // The CDN module can export the initializer in a few shapes; detect the function robustly.
        let initSqlJs = null
        if (typeof mod === 'function') initSqlJs = mod
        else if (mod && typeof mod.default === 'function') initSqlJs = mod.default
        else if (mod && typeof mod.initSqlJs === 'function') initSqlJs = mod.initSqlJs
        else if (mod && mod.default && typeof mod.default.initSqlJs === 'function') initSqlJs = mod.default.initSqlJs

        if (typeof initSqlJs === 'function') {
          SQL = await initSqlJs({ locateFile: file => `https://unpkg.com/sql.js@1.9.0/dist/${file}` })
        } else {
          console.warn('sqlStorage: dynamic import did not return initSqlJs function, falling back to script injection', mod)
          throw new Error('initSqlJs missing')
        }
      } catch (e) {
        // Fallback: inject script tag and use global initSqlJs
        await new Promise((resolve, reject) => {
          if (window.initSqlJs && typeof window.initSqlJs === 'function') return resolve()
          const existing = document.querySelector('script[data-sqljs-cdn]')
          if (existing) {
            existing.addEventListener('load', () => resolve())
            existing.addEventListener('error', err => reject(err))
            return
          }
          const s = document.createElement('script')
          s.src = 'https://unpkg.com/sql.js@1.9.0/dist/sql-wasm.js'
          s.setAttribute('data-sqljs-cdn', '1')
          s.onload = () => resolve()
          s.onerror = (err) => reject(err)
          document.head.appendChild(s)
        })
        if (window.initSqlJs && typeof window.initSqlJs === 'function') {
          SQL = await window.initSqlJs({ locateFile: file => `https://unpkg.com/sql.js@1.9.0/dist/${file}` })
        } else {
          console.error('sqlStorage: script injection fallback failed, initSqlJs not available on window')
          throw new TypeError('initSqlJs is not a function')
        }
      }
    }

    // Try to load DB from IndexedDB
    try {
      const saved = await idbGet(DB_KEY)
      if (saved) {
        // saved is stored as ArrayBuffer or Uint8Array
        const buf = saved instanceof Uint8Array ? saved : new Uint8Array(saved)
        db = new SQL.Database(buf)
      } else {
        db = new SQL.Database()
      }
    } catch (err) {
      console.warn('sqlStorage: failed to load DB from IndexedDB, creating new one', err)
      db = new SQL.Database()
    }

    // Ensure kv table exists
    db.run('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT)')
    await persist()
    return db
  } catch (err) {
    console.error('initSql failed to initialize sql.js or the DB', err)
    throw err
  }
}

async function persist() {
  if (!db) return
  try {
    const data = db.export()
    // store the raw ArrayBuffer into IndexedDB
    await idbSet(DB_KEY, data)
    return true
  } catch (err) {
    console.error('sqlStorage.persist failed', err)
    return false
  }
}

export async function sqlGet(key) {
  await initSql()
  try {
    const stmt = db.prepare('SELECT v FROM kv WHERE k = :k')
    stmt.bind({ ':k': key })
    if (stmt.step()) {
      const row = stmt.getAsObject()
      stmt.free()
      return row.v
    }
    stmt.free()
    return null
  } catch (err) {
    console.error('sqlGet error', err)
    return null
  }
}

export async function sqlSet(key, value) {
  await initSql()
  try {
    const stmt = db.prepare('INSERT OR REPLACE INTO kv (k,v) VALUES (:k,:v)')
    stmt.run({ ':k': key, ':v': value })
    stmt.free()
    await persist()
    return true
  } catch (err) {
    console.error('sqlSet error', err)
    return false
  }
}

export async function sqlDelete(key) {
  await initSql()
  try {
    const stmt = db.prepare('DELETE FROM kv WHERE k = :k')
    stmt.run({ ':k': key })
    stmt.free()
    await persist()
    return true
  } catch (err) {
    console.error('sqlDelete error', err)
    return false
  }
}

export async function sqlKeys() {
  await initSql()
  try {
    const res = db.exec('SELECT k FROM kv')
    if (!res || !res[0]) return []
    return res[0].values.map(r => r[0])
  } catch (err) {
    console.error('sqlKeys error', err)
    return []
  }
}

export async function sqlExportBase64() {
  await initSql()
  const data = db.export()
  let binary = ''
  for (let i = 0; i < data.length; i++) binary += String.fromCharCode(data[i])
  return btoa(binary)
}

export default { initSql, sqlGet, sqlSet, sqlDelete, sqlKeys, sqlExportBase64 }
