/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
// On GitHub Pages the app is served from /BigWealth-Client/ (project site),
// so the production build needs that base path. Dev/preview/test stay at '/'.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/BigWealth-Client/' : '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    css: true,
  },
}))
