import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const paymentsApiPort = process.env.PAYMENTS_API_PORT ?? 4242
const explainerPort = process.env.EXPLAINER_PORT ?? 4243

// The dashboard talks to the payments API (/lab) and the explainer (/api)
// through Vite's dev server, so the browser sees one origin.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/lab': `http://localhost:${paymentsApiPort}`,
      '/api': `http://localhost:${explainerPort}`,
    },
  },
})
