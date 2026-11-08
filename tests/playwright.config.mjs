import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
 testDir:'.',testMatch:['browser.spec.mjs','v21-integrated.spec.mjs'],timeout:35000,expect:{timeout:10000},
 fullyParallel:false,retries:1,workers:2,reporter:'list',
 use:{baseURL:'http://127.0.0.1:8765',locale:'fr-FR',trace:'retain-on-failure',acceptDownloads:true,serviceWorkers:'block'},
 projects:[
  {name:'chromium-desktop',use:{...devices['Desktop Chrome'],browserName:'chromium'}},
  {name:'firefox-desktop',use:{...devices['Desktop Firefox'],browserName:'firefox'}},
  {name:'webkit-mobile',use:{...devices['iPhone 13'],browserName:'webkit'}}
 ]
});
