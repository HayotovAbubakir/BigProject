// Minimal stub so the app still runs when vite-plugin-pwa isn't installed (e.g., in CI/offline dev).
export function registerSW() {
  return () => undefined
}
