import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Service worker/PWA disabled globally to stop offline mode.
export default defineConfig({
  plugins: [react()],
})
