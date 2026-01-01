// DevTools lock — parol qo'yib DevTools ni berkitish
const DEVTOOLS_PASSWORD = '0000'
// Progressive lockout settings
const ESCALATION_THRESH = 4 // after 4 consecutive wrong attempts escalate
const ESCALATION_DURATIONS = [1 * 60 * 1000, 5 * 60 * 1000] // 1 minute, then 5 minutes

// Restore state from sessionStorage so reloads keep counters
let consecutiveFailed = 0 // consecutive wrong attempts counter
let escalationLevel = 0 // which escalation duration to use next
let lockoutUntil = null
try {
  const raw = sessionStorage.getItem('devtools_lock_state')
  if (raw) {
    const parsed = JSON.parse(raw)
    consecutiveFailed = Number(parsed.consecutiveFailed) || 0
    escalationLevel = Number(parsed.escalationLevel) || 0
    lockoutUntil = parsed.lockoutUntil ? Number(parsed.lockoutUntil) : null
  }
} catch (e) {
  console.debug('devToolsLock: failed to restore state', e)
}

function persistState() {
  try {
    sessionStorage.setItem('devtools_lock_state', JSON.stringify({ consecutiveFailed, escalationLevel, lockoutUntil }))
  } catch (e) {
    console.debug('devToolsLock: persist failed', e)
  }
}

export function enableDevToolsLock() {
  // DevTools F12, Ctrl+Shift+I, Ctrl+Shift+C larni blokiralash
  document.addEventListener('keydown', (e) => {
    const isCtrlShift = (e.ctrlKey || e.metaKey) && e.shiftKey
    if ((e.key === 'F12') || (isCtrlShift && e.key === 'I') || (isCtrlShift && e.key === 'C') || (isCtrlShift && e.key === 'J')) {
      e.preventDefault()
      showPasswordPrompt()
      return false
    }
  }, true)

  // Right-click context menu ni blokiralash
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    showPasswordPrompt()
    return false
  }, true)

  // DevTools ochilganini detect qilish (Detection method)
  detectDevTools()
}

function detectDevTools() {
  const check = () => {
    const threshold = 160
    if (window.outerHeight - window.innerHeight > threshold || window.outerWidth - window.innerWidth > threshold) {
      lockScreen()
    }
  }
  setInterval(check, 500)
}

function isLockedOut() {
  if (!lockoutUntil) return false
  const now = Date.now()
  if (now < lockoutUntil) return true
  // Lockout expired
  lockoutUntil = null
  consecutiveFailed = 0
  escalationLevel = 0
  persistState()
  return false
}

function showPasswordPrompt() {
  if (isLockedOut()) {
    const remainingMs = lockoutUntil - Date.now()
    const remainingSeconds = Math.ceil(remainingMs / 1000)
    alert(`❌ Juda ko'p marta notog'ri parol kiritdingiz!\n\nYangi urinish uchun ${remainingSeconds} soniya kuting.`)
    lockScreen()
    return
  }

  // show full-screen overlay before native prompt so background is dimmed
  try { lockScreen() } catch (err) { /* ignore overlay errors */ }
  const password = prompt('DevTools yopilgan. Parol kiriting:', '')
  // if user cancelled the prompt, remove overlay and return
  if (password === null) {
    try { unlockScreen() } catch (err) { /* ignore */ }
    return
  }
  if (password === DEVTOOLS_PASSWORD) {
    console.log('✓ DevTools unlock qilindi')
    // Remove overlay and reset counters
    try { unlockScreen() } catch (e) { /* ignore */ }
    consecutiveFailed = 0
    escalationLevel = 0
    lockoutUntil = null
    persistState()
  } else if (password !== null) {
    // Wrong password entered
    consecutiveFailed++
    console.debug('devToolsLock: wrong password, consecutiveFailed=', consecutiveFailed, 'escalationLevel=', escalationLevel)
    const remainingToEscalate = Math.max(ESCALATION_THRESH - consecutiveFailed, 0)

    if (consecutiveFailed >= ESCALATION_THRESH) {
      // apply escalation duration for current escalation level
      const idx = Math.min(escalationLevel, ESCALATION_DURATIONS.length - 1)
      const dur = ESCALATION_DURATIONS[idx]
      lockoutUntil = Date.now() + dur
      const minutes = Math.ceil(dur / 60000)
      alert(`❌ Parol noto'g'ri!\n\nHimoya faollashtirildi: ${minutes} daqiqa kuting.`)
      // prepare for next escalation (if further abuse)
      escalationLevel = Math.min(escalationLevel + 1, ESCALATION_DURATIONS.length - 1)
      consecutiveFailed = 0
      persistState()
    } else {
      alert(`❌ Parol noto'g'ri!\n\nQolgan urinishlar bosqichga yetish uchun: ${remainingToEscalate}`)
    }
    lockScreen()
  }
}

function lockScreen() {
  // Black overlay qo'shish
  if (!document.querySelector('#devtools-lock-overlay')) {
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
        <h2>🔒 DevTools yopilgan</h2>
        <p>Parol kiritish uchun F12 yoki Ctrl+Shift+I bosing</p>
      </div>
    `
    document.body.appendChild(overlay)
  }
}

function unlockScreen() {
  const overlay = document.querySelector('#devtools-lock-overlay')
  if (overlay) {
    try { overlay.remove() } catch (err) { console.debug('unlockScreen failed', err) }
  }
}

export default enableDevToolsLock
