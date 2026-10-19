import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import RubyPlugin from 'vite-plugin-ruby'

export default defineConfig({
  plugins: [
    react(),
    RubyPlugin(),
  ],
  server: {
    host: '127.0.0.1',
  },
  test: {
    environment: 'jsdom',
    include: ['../../test/frontend/**/*.test.ts', '../../test/frontend/**/*.test.tsx'],
  },
})
