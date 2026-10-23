import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  base: command === 'serve' ? '/' : '/events/',
  plugins: [react()],
  assetsInclude: ['**/*.PNG'],
  esbuild: {
    drop: command === 'build' ? ['console', 'debugger'] : []
  },
  server: {
    proxy: {
      '/razorpay-api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/razorpay-api/, '/razorpay-proxy.php?route=')
      }
    }
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-firebase-app': ['firebase/app', 'firebase/analytics'],
          'vendor-firestore': ['firebase/firestore'],
          'vendor-motion': ['framer-motion'],
          'vendor-redux': ['@reduxjs/toolkit', 'react-redux'],
          'vendor-icons': ['lucide-react']
        }
      }
    }
  }
}))
