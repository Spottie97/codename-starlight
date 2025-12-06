import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 3000,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://backend:4000',
        changeOrigin: true,
      },
      '/ws': {
        target: process.env.VITE_WS_URL || 'ws://backend:4000',
        ws: true,
      },
    },
  },
  // Build optimizations for production
  build: {
    // Enable minification
    minify: 'esbuild',
    // Generate source maps for debugging (can be disabled for smaller builds)
    sourcemap: false,
    // Chunk splitting for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate heavy Konva/React-Konva into its own chunk
          // This rarely changes so can be cached long-term
          'canvas': ['konva', 'react-konva'],
          // Core React libraries
          'vendor': ['react', 'react-dom'],
          // State management
          'state': ['zustand'],
          // UI utilities
          'ui': ['lucide-react', 'clsx', 'tailwind-merge'],
        },
      },
    },
    // Increase chunk size warning limit (Konva is large but necessary)
    chunkSizeWarningLimit: 500,
  },
  // Optimize dependency pre-bundling
  optimizeDeps: {
    include: ['react', 'react-dom', 'konva', 'react-konva', 'zustand'],
  },
})




