import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', workers: 1, retries: 0, timeout: 120000,
  use: { baseURL: 'http://127.0.0.1:3000', browserName: 'chromium', trace: 'off' },
  webServer: { command: 'npm run start -- --hostname 127.0.0.1', url: 'http://127.0.0.1:3000/login', timeout: 120000, reuseExistingServer: false },
});
