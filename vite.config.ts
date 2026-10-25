import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: 'app',
  publicDir: '../public',
  plugins: [react()],
  base: '/peppercorn/',
  server: { allowedHosts: ['terminal.local'] },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/app-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: assetInfo =>
          assetInfo.name?.endsWith('.css')
            ? 'assets/app.css'
            : 'assets/[name][extname]'
      }
    }
  }
})
