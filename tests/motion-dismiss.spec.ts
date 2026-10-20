import { test, expect, type Page } from '@playwright/test'
import { demoRows } from '../src/data/mock'
import { blankSnapshot, type JournalEntry } from '../src/lib/lifetimeJournal'
import { openPage } from './journey-helpers'

async function boot(page:Page,theme='light') {
 await page.addInitScript(theme=>{localStorage.setItem('folio-theme',theme);localStorage.setItem('folio-stock-size','all');sessionStorage.setItem('peppercorn-intro-seen','1')},theme)
 for(const path of ['leaderboard','stock-flags','leader-insights'])await page.route(`**/data/${path}.json*`,r=>r.fulfill({status:404,body:''}))
 await page.route('**/functions/v1/leaderboard?*',r=>r.fulfill({json:{rows:demoRows}}))
 await page.route('**/functions/v1/position-public?*',r=>r.fulfill({json:{rows:[]}}))
 await page.route('**/functions/v1/price-history?*',r=>r.fulfill({json:{series:{}}}))
 await page.goto('/peppercorn/')
}
async function seed(page:Page,entries:JournalEntry[]) {
 await page.evaluate(entries=>new Promise<void>((resolve,reject)=>{const r=indexedDB.open('folio-lifetime-journal',1);r.onsuccess=()=>{const db=r.result,t=db.transaction('notebooks','readwrite');t.objectStore('notebooks').put(entries,'guest');t.oncomplete=()=>{db.close();resolve()};t.onerror=()=>reject(t.error)};r.onerror=()=>reject(r.error)}),entries)
 await page.reload()
}
async function pull(page:Page,touch:boolean,distance=145,horizontal=0) {
 const box=(await page.getByRole('dialog').boundingBox())!,x=box.x+box.width/2,y=box.y+80
 if(touch) {
  const cdp=await page.context().newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]})
  for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+horizontal*i/8,y:y+distance*i/8}]})
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach()
 }else{await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+horizontal,y+distance,{steps:8});await page.mouse.up()}
}
for(const width of [390,834,1366,1440])for(const theme of ['light','dark'])test(`Motion dismissal ${width} ${theme}: pull, scroll and backdrop without X`,async({browser})=>{
 const touch=width<1440,context=await browser.newContext({viewport:{width,height:600},hasTouch:touch,reducedMotion:'reduce'}),page=await context.newPage();await boot(page,theme)
 const covers=page.locator('.home-motion-card');await expect(covers).toHaveCount(4)
 // Portrait keeps four staggered covers; every landscape viewport uses the full-bleed hero.
 const sizes=await covers.evaluateAll(els=>els.map(el=>`${(el as HTMLElement).offsetWidth}x${(el as HTMLElement).offsetHeight}`));if(width<600)expect(new Set(sizes).size).toBe(4);else{const lead=await covers.first().boundingBox(),story=await covers.nth(1).boundingBox();expect(lead!.width).toBeCloseTo(width,0);expect(lead!.height).toBeGreaterThanOrEqual(220);expect(story!.height).toBeGreaterThanOrEqual(220);expect(new Set(sizes.slice(1)).size).toBe(1)}
 for(const key of ['today','discover','journal','journey'])await expect(page.locator(`.home-${key}>img`)).toHaveAttribute('src',`/peppercorn/folio-retro-${key}.webp`)
 const opener=page.getByRole('button',{name:'오늘 카드 열기'});await opener.click();await expect(page.getByRole('dialog')).toBeVisible();await expect(page.locator('.journal-dialog-close')).toHaveCount(0);await expect(page.locator('.card-dismiss-handle svg')).toHaveCount(0)
 await pull(page,touch,0,145);await expect(page.getByRole('dialog')).toBeVisible()
 await pull(page,touch,25);await expect(page.getByRole('dialog')).toBeVisible()
 if(touch){await page.getByRole('dialog').evaluate(el=>{el.scrollTop=180});await pull(page,true);await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('dialog').evaluate(async el=>{const node=el as HTMLElement;node.style.overflow='hidden';node.scrollTop=0;await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);node.style.overflow='auto'})}
 await pull(page,touch);await expect(page.getByRole('dialog')).toHaveCount(0);await expect(opener).toBeFocused()
 await page.getByRole('button',{name:'발견 카드 열기'}).click();await expect(page.getByRole('dialog')).toBeVisible()
 if(!touch){const box=(await page.getByRole('dialog').boundingBox())!;await page.mouse.click(box.x-8,box.y+100);await expect(page.getByRole('dialog')).toHaveCount(0)}else{await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0)}
 await context.close()
})
test('personal photos keep Journal priority without duplicates and failed photos return to defaults',async({page})=>{
 await boot(page);const at=new Date().toISOString(),entry={...blankSnapshot(),id:'own-photo',title:'직접 기록한 사진',kind:'investment' as const,ticker:`${demoRows[0].market}:${demoRows[0].ticker}`,photos:['/peppercorn/folio-brand-photography.webp'],createdAt:at,updatedAt:at,revisions:[]}
 await seed(page,demoRows.map((r,i)=>({...entry,id:'photo-'+i,ticker:r.market+':'+r.ticker})));await expect.poll(()=>page.locator('.home-motion-card>img').evaluateAll(els=>els.filter(el=>el.getAttribute('src')==='/peppercorn/folio-brand-photography.webp').length)).toBe(1);await expect(page.locator('.home-journal>img')).toHaveAttribute('src',entry.photos[0])
 const treatment=await page.locator('.home-motion-card>img').first().evaluate(el=>getComputedStyle(el).filter);expect(treatment).not.toBe('none')
 await page.getByRole('button',{name:'저널 카드 열기'}).click();await expect(page.locator('.home-detail-cover>img')).toHaveAttribute('src',entry.photos[0]);expect(await page.locator('.home-detail-cover>img').evaluate(el=>getComputedStyle(el).filter)).toBe(treatment);await page.keyboard.press('Escape')
 await seed(page,demoRows.map((r,i)=>({...entry,id:'photo-'+i,ticker:r.market+':'+r.ticker,photos:['/peppercorn/missing-personal-photo.webp']})));for(const key of ['today','discover','journal','journey'])await expect(page.locator(`.home-${key}>img`)).toHaveAttribute('src',`/peppercorn/folio-retro-${key}.webp`)
})
test('journal glass separates thumbnails; pull and outside dismissal preserve dirty edits',async({browser})=>{
 const context=await browser.newContext({viewport:{width:834,height:1000},hasTouch:true,reducedMotion:'reduce'}),page=await context.newPage();await boot(page)
 const entry:JournalEntry={...blankSnapshot(),id:'glass-entry',title:'나의 가설',kind:'investment',text:'원본 기록',body:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'원본 기록'}]}]},createdAt:'2026-10-12T00:00:00Z',updatedAt:'2026-10-12T00:00:00Z',revisions:[]};await seed(page,[entry]);await openPage(page,'저널')
 const card=page.getByRole('button',{name:'나의 가설 기록 열기'});const glass=await card.evaluate(el=>({background:getComputedStyle(el).backgroundColor,blur:getComputedStyle(el).backdropFilter,shadow:getComputedStyle(el).boxShadow}));expect(glass.background).not.toBe('rgba(0, 0, 0, 0)');expect(glass.blur).toContain('blur(20px)');expect(glass.shadow).toContain('inset')
 await card.click();await page.getByLabel('기록 제목').fill('미저장 생각')
 page.once('dialog',d=>d.dismiss());await pull(page,true);await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByLabel('기록 제목')).toHaveValue('미저장 생각')
 const box=(await page.getByRole('dialog').boundingBox())!;page.once('dialog',d=>d.dismiss());await page.mouse.click(box.x-8,box.y+200);await expect(page.getByRole('dialog')).toBeVisible()
 await page.getByRole('button',{name:'페이지 저장',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('button',{name:'미저장 생각 기록 열기'})).toBeVisible();await context.close()
})
