import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
 testDir:'.',testMatch:'pixel-v21.spec.mjs',timeout:50000,expect:{timeout:12000},
 fullyParallel:false,retries:1,workers:1,reporter:'list',
 use:{baseURL:'http://127.0.0.1:8765',locale:'fr-FR',serviceWorkers:'block',trace:'retain-on-failure'},
 projects:[
  {name:'chromium-desktop',use:{...devices['Desktop Chrome'],browserName:'chromium'}},
  {name:'firefox-desktop',use:{...devices['Desktop Firefox'],browserName:'firefox'}},
  {name:'webkit-mobile',use:{...devices['iPhone 13'],browserName:'webkit'}}
 ]
});
