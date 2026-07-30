import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  base: '/TideVR/',
  server: {
    host: true,
    port: 5175,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
