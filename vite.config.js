import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  base: command === 'serve' ? '/' : '/events/',
  plugins: [react()],
  server: {
    proxy: {
      '/razorpay-api': {
        target: 'https://api.razorpay.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/razorpay-api/, '')
      }
    }
  }
}))
