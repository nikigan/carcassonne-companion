import { defineConfig } from 'vitest/config'

// Standalone on purpose: does NOT load vite.config.ts (which carries the
// Cloudflare plugin), so pure-logic tests run in a plain, fast node env.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
