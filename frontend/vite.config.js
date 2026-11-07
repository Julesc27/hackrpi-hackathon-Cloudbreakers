import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,        // listen on 0.0.0.0 so Docker can expose it
    port: 5173,
    strictPort: true,
    watch: { usePolling: true },
  },
})
