import { defineConfig } from 'vitest/config'

// The e2e specs are Playwright's, not vitest's — they share the `.spec` habit but
// not the runner, so exclude them rather than let vitest collect and fail them.
export default defineConfig({
  test: { include: ['src/**/*.test.ts'] },
})
