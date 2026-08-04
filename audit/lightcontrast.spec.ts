import { test, expect, type Page } from '@playwright/test'
import { writeFileSync } from 'node:fs'
const url=(s:string,p='')=>`http://${s}.localhost:3100${p}`
async function signIn(page:Page,site:string){await page.goto(url(site),{waitUntil:'domcontentloaded'});const b=page.getByText('Sign in',{exact:true}).first();await b.waitFor({state:'visible',timeout:60_000});await b.click();await page.waitForURL(new RegExp(`^http://${site}\\.localhost:3100/(\\?|$)`),{timeout:60_000});await expect(page.getByText('z',{exact:true}).first()).toBeVisible({timeout:60_000})}

test('light theme contrast of record data', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page,'erp')
  await page.goto(url('erp','/erp-item'),{waitUntil:'domcontentloaded'})
  await expect(page.getByText('Axial servo drive').first()).toBeVisible({timeout:60_000})
  await page.waitForTimeout(700)
  await page.locator('[aria-label="Account"]').first().click(); await page.waitForTimeout(700)
  await page.locator('[aria-label="Switch to light theme"]').first().click(); await page.waitForTimeout(1500)
  await page.keyboard.press('Escape'); await page.waitForTimeout(500)

  const res = await page.evaluate(() => {
    const parse=(c:string)=>{const m=c.match(/[\d.]+/g)!.map(Number);return m.length>=3?[m[0],m[1],m[2],m[3]??1]:[0,0,0,1]}
    const lum=(r:number,g:number,b:number)=>{const f=(v:number)=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b)}
    const effBg=(el:Element):number[]=>{let e:Element|null=el;while(e){const c=parse(getComputedStyle(e).backgroundColor);if(c[3]>0.05)return c;e=e.parentElement}return [255,255,255,1]}
    const out:any[]=[]
    const wanted=['SV-001','Services','$190.00','CT-045','Electronics','Commissioning service','ITEM CODE','Item Code']
    document.querySelectorAll('span,div').forEach(el=>{
      if(el.children.length) return
      const t=(el.textContent||'').trim(); if(!wanted.includes(t)) return
      const fg=parse(getComputedStyle(el).color), bg=effBg(el)
      const L1=lum(fg[0],fg[1],fg[2]), L2=lum(bg[0],bg[1],bg[2])
      const ratio=(Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05)
      if(!out.find(o=>o.text===t)) out.push({text:t,color:getComputedStyle(el).color,bg:`rgb(${bg.slice(0,3)})`,contrast:+ratio.toFixed(2),passesAA:ratio>=4.5})
    })
    // header background vs page background
    const hdr=document.querySelector('[aria-label="Apps"]')?.closest('div')
    return { samples: out, headerBg: hdr?getComputedStyle(hdr).backgroundColor:null, bodyBg:getComputedStyle(document.body).backgroundColor }
  })
  console.log(JSON.stringify(res,null,1))
  writeFileSync('audit-shots/light-contrast.json',JSON.stringify(res,null,2))
  await page.screenshot({ path:'audit-shots/light-records-mobile.png' })
  await page.goto(url('erp','/erp-item/AX-100'),{waitUntil:'domcontentloaded'}); await page.waitForTimeout(1500)
  await page.screenshot({ path:'audit-shots/light-detail-mobile.png', fullPage:true })
  await page.setViewportSize({width:1440,height:900}); await page.goto(url('erp','/erp-item'),{waitUntil:'domcontentloaded'}); await page.waitForTimeout(1800)
  await page.screenshot({ path:'audit-shots/light-records-desktop.png' })
})
