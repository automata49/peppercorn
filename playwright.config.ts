import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir:'./tests',fullyParallel:true,workers:2,
  use:{baseURL:'http://127.0.0.1:4173/peppercorn/',browserName:'chromium',trace:'retain-on-failure'},
  webServer:{command:'npm run preview -- --host 127.0.0.1 --port 4173',url:'http://127.0.0.1:4173/peppercorn/',reuseExistingServer:!process.env.CI},
})
