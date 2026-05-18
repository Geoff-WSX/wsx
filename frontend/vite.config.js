import { defineConfig } from 'vite'
import fs from 'fs'
import path from 'path'

// 读取实际后端端口 (从项目根目录读取)
function getBackendPort() {
    const portFile = path.join(__dirname, '..', '.wsx-port')
    if (fs.existsSync(portFile)) {
        return fs.readFileSync(portFile, 'utf-8').trim()
    }
    return process.env.WSX_PORT || '3000'
}

const backendPort = getBackendPort()
console.log('🔌 后端代理目标端口:', backendPort)

export default defineConfig({
  root: '.',
  publicDir: '../public',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: `http://localhost:${backendPort}`,
        changeOrigin: true,
        rewrite: (path) => path,
        configure: (proxy) => {
          proxy.on('error', (err, req, res) => {
            console.error('⚠️  API 代理错误:', err.message)
          })
        }
      },
      '/ws': {
        target: `ws://localhost:${backendPort}`,
        ws: true,
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true
  }
})
