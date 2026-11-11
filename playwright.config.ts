import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/web',
  use: { baseURL: 'http://127.0.0.1:4173', browserName: 'chromium', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: `${process.platform === 'win32' ? 'python' : 'python3'} -m http.server 4173 --bind 127.0.0.1 --directory dist-web`, url: 'http://127.0.0.1:4173', reuseExistingServer: false },
  projects: [
    { name: 'mobile', use: { viewport: { width: 390, height: 844 } } },
    { name: 'narrow-dark', use: { viewport: { width: 320, height: 740 }, colorScheme: 'dark' } },
  ],
});
