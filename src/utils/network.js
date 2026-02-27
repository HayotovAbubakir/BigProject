// Lightweight helpers to adapt requests to slow/limited networks (2G/3G/offline)
// All values are computed defensively so they are safe in SSR and tests.

const getConnection = () => {
  if (typeof navigator === 'undefined') return null
  return navigator.connection || navigator.mozConnection || navigator.webkitConnection || null
}

export const getConnectionInfo = () => {
  const conn = getConnection()
  const effectiveType = conn?.effectiveType || 'unknown'
  const saveData = !!conn?.saveData
  const downlink = typeof conn?.downlink === 'number' ? conn.downlink : null
  const offline = typeof navigator !== 'undefined' ? !navigator.onLine : false
  const slowByType = ['slow-2g', '2g', '3g'].includes(effectiveType)
  const slowByDownlink = downlink !== null ? downlink < 1.5 : false // ~<1.5 Mbps
  return {
    effectiveType,
    saveData,
    downlink,
    offline,
    slow: offline || saveData || slowByType || slowByDownlink,
  }
}

export const isSlowConnection = () => getConnectionInfo().slow

export const safeLimit = (fastLimit = 100, slowLimit = 20) =>
  isSlowConnection() ? slowLimit : fastLimit

export const shouldSkipHeavyMedia = () => {
  const info = getConnectionInfo()
  return info.offline || info.saveData || info.slow
}
