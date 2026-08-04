import { test, expect, type Page } from '@playwright/test'
const url=(s:string,p='')=>`http://${s}.localhost:3100${p}`
async function signIn(page:Page,site:string){await page.goto(url(site),{waitUntil:'domcontentloaded'});const b=page.getByText('Sign in',{exact:true}).first();await b.waitFor({state:'visible',timeout:60_000});await b.click();await page.waitForURL(new RegExp(`^http://${site}\\.localhost:3100/(\\?|$)`),{timeout:60_000});await expect(page.getByText('z',{exact:true}).first()).toBeVisible({timeout:60_000})}
test('light theme desktop: what is invisible', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await signIn(page,'erp')
  await page.goto(url('erp','/erp-item'),{waitUntil:'domcontentloaded'})
  await expect(page.getByText('Axial servo drive').first()).toBeVisible({timeout:60_000}); await page.waitForTimeout(700)
  await page.locator('[aria-label="Account"]').first().click(); await page.waitForTimeout(600)
  await page.locator('[aria-label="Switch to light theme"]').first().click(); await page.waitForTimeout(1500)
  await page.keyboard.press('Escape'); await page.waitForTimeout(600)
  console.log(JSON.stringify(await page.evaluate(() => {
    const parse=(c:string)=>{const m=c.match(/[\d.]+/g)!.map(Number);return [m[0],m[1],m[2],m[3]??1]}
    const lum=(r:number,g:number,b:number)=>{const f=(v:number)=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b)}
    const effBg=(el:Element):number[]=>{let e:Element|null=el;while(e){const c=parse(getComputedStyle(e).backgroundColor);if(c[3]>0.05)return c;e=e.parentElement}return [255,255,255,1]}
    const want=['erp-item','Filter','Sort','Table','Board','SV-001','1–4 of 4']
    const out:any[]=[]
    document.querySelectorAll('span,div,h1,h2').forEach(el=>{ if(el.children.length) return
      const t=(el.textContent||'').trim(); if(!want.includes(t)||out.find(o=>o.text===t)) return
      const fg=parse(getComputedStyle(el).color), bg=effBg(el)
      const r=(Math.max(lum(fg[0],fg[1],fg[2]),lum(bg[0],bg[1],bg[2]))+0.05)/(Math.min(lum(fg[0],fg[1],fg[2]),lum(bg[0],bg[1],bg[2]))+0.05)
      out.push({text:t,fg:getComputedStyle(el).color,bg:`rgb(${bg.slice(0,3)})`,contrast:+r.toFixed(2),passesAA:r>=4.5})
    })
    return out
  }),null,1))
})
