import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  base: command === 'serve' ? '/' : '/events/',
  plugins: [react()],
  assetsInclude: ['**/*.PNG'],
  server: {
    proxy: {
      '/razorpay-api': {
        target: 'https://api.razorpay.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/razorpay-api/, '')
      }
    }
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-firebase': ['firebase/app', 'firebase/firestore', 'firebase/analytics'],
          'vendor-motion': ['framer-motion'],
          'vendor-redux': ['@reduxjs/toolkit', 'react-redux'],
          'vendor-icons': ['lucide-react']
        }
      }
    }
  }
}))
