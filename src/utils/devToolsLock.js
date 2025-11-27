// DevTools lock — parol qo'yib DevTools ni berkitish
const DEVTOOLS_PASSWORD = '0000'
const MAX_ATTEMPTS = 5
const LOCKOUT_DURATION = 5 * 60 * 1000 // 5 minutes in milliseconds

let failedAttempts = 0
let lockoutUntil = null

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
  failedAttempts = 0
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

  const password = prompt('DevTools yopilgan. Parol kiriting:', '')
  if (password === DEVTOOLS_PASSWORD) {
    console.log('✓ DevTools unlock qilindi')
    failedAttempts = 0
    lockoutUntil = null
  } else if (password !== null) {
    failedAttempts++
    const remaining = MAX_ATTEMPTS - failedAttempts
    if (failedAttempts >= MAX_ATTEMPTS) {
      lockoutUntil = Date.now() + LOCKOUT_DURATION
      alert(`❌ Parol noto'g'ri!\n\n5 daqiqaga pin-kod qilinadi.`)
    } else {
      alert(`❌ Parol noto'g'ri!\n\nQolgan urinishlar: ${remaining}`)
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

export default enableDevToolsLock
