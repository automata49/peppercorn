import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: 'app',
  publicDir: '../public',
  plugins: [react()],
  base: '/peppercorn/',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: true
  }
})
