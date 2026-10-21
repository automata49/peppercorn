import {openPage} from './journey-helpers'
import {test,expect} from '@playwright/test'
import {demoRows} from '../src/data/mock'
const row={id:'j-aapl',date:'2026-10-01',market:'US',ticker:'AAPL',name:'Apple',thesis:'테스트 가설',currency:'USD',review_condition:'MA50 이탈',review_date:'2026-10-15'}
async function boot(page:any){
 await page.addInitScript(()=>sessionStorage.setItem('peppercorn-intro-seen','1'))
 await page.addInitScript(row=>localStorage.setItem('peppercorn-journal',JSON.stringify([row])),row)
 await page.route('**/functions/v1/leaderboard?*',r=>r.fulfill({json:{rows:demoRows}}))
 await page.route('**/functions/v1/position-public?*',r=>r.fulfill({json:{rows:[]}}))
 await page.goto('/peppercorn/')
}
for(const [width,height] of [[390,844],[1440,900]])test(`linked trading journal opens in unified notes at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height});await boot(page);await openPage(page,'저널')
 const source=page.getByRole('button',{name:/Apple · 투자일지 기록 열기/})
 await expect(source).toHaveCount(1)
 await source.click()
 await expect(page.getByRole('article',{name:'저널 읽기'})).toBeVisible()
 await expect(page.getByRole('button',{name:'수정'})).toBeVisible()
 await page.getByRole('button',{name:'수정'}).click()
 await expect(page.getByLabel('기록 제목')).toHaveValue('Apple · 투자일지')
 await expect(page.getByLabel('내 가설')).toHaveValue('테스트 가설')
 await expect(page.getByRole('button',{name:'Financial 정보 불러오기'})).toBeVisible()
 await page.keyboard.press('Escape')
 await openPage(page,'여정')
 await page.getByLabel('내 기록 검색').fill('테스트 가설')
 await expect(page.locator('.decision-queue-item')).toHaveCount(1)
})
