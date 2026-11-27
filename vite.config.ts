import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { bootCss, bootScript } from './src/styles/themeBoot'

// index.html gets the design values (as CSS variables) and the saved theme in
// its <head>, so the first paint is already right while the app's JavaScript is
// still on its way. Both come from src/styles/tokens.ts: no colour is typed
// into index.html.
const themeBoot = (): Plugin => ({
  name: 'theme-boot',
  transformIndexHtml: () => [
    { tag: 'script', children: bootScript(), injectTo: 'head-prepend' },
    { tag: 'style', attrs: { 'data-app-tokens': '' }, children: bootCss(), injectTo: 'head-prepend' },
  ],
})

export default defineConfig({
  plugins: [react(), themeBoot()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
