const DEVTOOLS_PASSWORD = import.meta.env.VITE_DEVTOOLS_LOCK_PASSWORD || ''
const ESCALATION_THRESH = 4
const ESCALATION_DURATIONS = [1 * 60 * 1000, 5 * 60 * 1000]
const DETECTION_INTERVAL_MS = 1500
const DETECTION_THRESHOLD = 160

let isDevToolsLockEnabled = import.meta.env.DEV && import.meta.env.VITE_DEVTOOLS_LOCK === 'true' && !!DEVTOOLS_PASSWORD

let consecutiveFailed = 0
let escalationLevel = 0
let lockoutUntil = null
let cleanupCurrentLock = null

function persistState() {
  // Persistence is intentionally disabled.
}

function isLockedOut() {
  if (!lockoutUntil) return false
  const now = Date.now()
  if (now < lockoutUntil) return true

  lockoutUntil = null
  consecutiveFailed = 0
  escalationLevel = 0
  persistState()
  return false
}

function unlockScreen() {
  const overlay = document.querySelector('#devtools-lock-overlay')
  if (overlay) {
    try {
      overlay.remove()
    } catch (error) {
      console.debug('unlockScreen failed', error)
    }
  }
}

function lockScreen() {
  if (document.querySelector('#devtools-lock-overlay')) return

  const overlay = document.createElement('div')
  overlay.id = 'devtools-lock-overlay'
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 99999;
    font-family: Arial, sans-serif;
    color: white;
  `
  overlay.innerHTML = `
    <div style="text-align: center;">
      <h2>DevTools yopilgan</h2>
      <p>Parol kiritish uchun F12 yoki Ctrl+Shift+I bosing</p>
    </div>
  `
  document.body.appendChild(overlay)
}

function showPasswordPrompt() {
  if (isLockedOut()) {
    const remainingMs = lockoutUntil - Date.now()
    const remainingSeconds = Math.ceil(remainingMs / 1000)
    alert(`Juda ko'p marta noto'g'ri parol kiritdingiz.\n\nYangi urinish uchun ${remainingSeconds} soniya kuting.`)
    lockScreen()
    return
  }

  try {
    lockScreen()
  } catch (error) {
    console.debug('lockScreen failed', error)
  }

  const password = prompt('DevTools yopilgan. Parol kiriting:', '')
  if (password === null) {
    unlockScreen()
    return
  }

  if (password === DEVTOOLS_PASSWORD) {
    unlockScreen()
    consecutiveFailed = 0
    escalationLevel = 0
    lockoutUntil = null
    persistState()
    return
  }

  consecutiveFailed += 1
  const remainingToEscalate = Math.max(ESCALATION_THRESH - consecutiveFailed, 0)

  if (consecutiveFailed >= ESCALATION_THRESH) {
    const escalationIndex = Math.min(escalationLevel, ESCALATION_DURATIONS.length - 1)
    const duration = ESCALATION_DURATIONS[escalationIndex]
    lockoutUntil = Date.now() + duration
    const minutes = Math.ceil(duration / 60000)
    alert(`Parol noto'g'ri.\n\nHimoya faollashtirildi: ${minutes} daqiqa kuting.`)
    escalationLevel = Math.min(escalationLevel + 1, ESCALATION_DURATIONS.length - 1)
    consecutiveFailed = 0
    persistState()
  } else {
    alert(`Parol noto'g'ri.\n\nQolgan urinishlar bosqichga yetish uchun: ${remainingToEscalate}`)
  }

  lockScreen()
}

function createKeydownHandler() {
  return (event) => {
    const isCtrlShift = (event.ctrlKey || event.metaKey) && event.shiftKey
    const key = (event.key || '').toUpperCase()
    const shouldIntercept =
      key === 'F12' ||
      (isCtrlShift && (key === 'I' || key === 'C' || key === 'J'))

    if (!shouldIntercept) return

    event.preventDefault()
    showPasswordPrompt()
  }
}

function createContextMenuHandler() {
  return (event) => {
    event.preventDefault()
    showPasswordPrompt()
  }
}

function createDetectionChecker() {
  return () => {
    const outerHeightDelta = window.outerHeight - window.innerHeight
    const outerWidthDelta = window.outerWidth - window.innerWidth
    if (outerHeightDelta > DETECTION_THRESHOLD || outerWidthDelta > DETECTION_THRESHOLD) {
      lockScreen()
    }
  }
}

export function enableDevToolsLock() {
  if (cleanupCurrentLock) {
    cleanupCurrentLock()
    cleanupCurrentLock = null
  }

  if (!isDevToolsLockEnabled || typeof document === 'undefined' || typeof window === 'undefined') {
    return () => {}
  }

  const handleKeydown = createKeydownHandler()
  const handleContextMenu = createContextMenuHandler()
  const checkDevTools = createDetectionChecker()

  document.addEventListener('keydown', handleKeydown, true)
  document.addEventListener('contextmenu', handleContextMenu, true)
  const intervalId = window.setInterval(checkDevTools, DETECTION_INTERVAL_MS)

  cleanupCurrentLock = () => {
    document.removeEventListener('keydown', handleKeydown, true)
    document.removeEventListener('contextmenu', handleContextMenu, true)
    window.clearInterval(intervalId)
    unlockScreen()
  }

  return cleanupCurrentLock
}

export default enableDevToolsLock

export function disableDevToolsLock() {
  isDevToolsLockEnabled = false
  if (cleanupCurrentLock) {
    cleanupCurrentLock()
    cleanupCurrentLock = null
  } else {
    unlockScreen()
  }
  console.log('DevTools lock disabled - PIN code not required')
}

export function enableDevToolsLockAgain() {
  isDevToolsLockEnabled = true
  console.log('DevTools lock enabled - PIN code required')
}

if (typeof window !== 'undefined') {
  window.disableDevToolsLock = disableDevToolsLock
  window.enableDevToolsLockAgain = enableDevToolsLockAgain
}
