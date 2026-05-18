import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  publicDir: '../public',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path
      }
    }
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true
  }
})
