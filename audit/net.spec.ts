import { test, expect, type Page } from '@playwright/test'
const url=(s:string,p='')=>`http://${s}.localhost:3100${p}`
test('what 404s / what goes off-origin', async ({ page }) => {
  const bad:string[]=[]; const external:string[]=[]
  page.on('response', r=>{ if(r.status()>=400) bad.push(r.status()+' '+r.url().slice(0,120)) })
  page.on('request', r=>{ const u=r.url(); if(!/localhost|127\.0\.0\.1/.test(u)) external.push(r.method()+' '+u.slice(0,110)) })
  await page.setViewportSize({width:390,height:844})
  await page.goto(url('erp'),{waitUntil:'domcontentloaded'})
  const b=page.getByText('Sign in',{exact:true}).first(); await b.waitFor({state:'visible',timeout:60_000}); await b.click()
  await page.waitForURL(/^http:\/\/erp\.localhost:3100\/(\?|$)/,{timeout:60_000})
  await expect(page.getByText('z',{exact:true}).first()).toBeVisible({timeout:60_000})
  await page.goto(url('erp','/erp-item'),{waitUntil:'domcontentloaded'}); await page.waitForTimeout(2500)
  console.log('4xx/5xx:', JSON.stringify([...new Set(bad)],null,1))
  console.log('OFF-ORIGIN:', JSON.stringify([...new Set(external)],null,1))
})
