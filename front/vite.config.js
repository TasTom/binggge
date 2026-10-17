import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxy = {
    '/api': {
      target: env.API_PROXY_TARGET || 'http://127.0.0.1:3000',
      changeOrigin: true,
      rewrite: path => path.replace(/^\/api/, ''),
    },
  }

  return {
    plugins: [react()],
    base: env.VITE_BASE_PATH || '/',
    server: { port: 5173, strictPort: true, proxy },
    preview: { proxy },
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.js',
      clearMocks: true,
    },
  }
})
