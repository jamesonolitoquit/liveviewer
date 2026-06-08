import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3005',
    trace: 'on-first-retry',
  },
  webServer: {
    command: process.env.CI ? 'npm run start -- -p 3005' : 'npm run dev -- -p 3005',
    port: 3005,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
