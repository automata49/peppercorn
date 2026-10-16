import {test,expect,type Page} from '@playwright/test'
import {blankSnapshot,parseNotebook,snapshot,type JournalEntry,type Reflection} from '../src/lib/lifetimeJournal'
import {currentJudgement,latestReview,reviewStatus,reviewOrder} from '../src/lib/decisionReview'
import {demoRows} from '../src/data/mock'
import {openPage} from './journey-helpers'
const base=(id='decision'):JournalEntry=>({...blankSnapshot(),id,title:'수요의 지속성',kind:'investment',hypothesis:'기존 가설',text:'원본 본문',body:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'원본 본문'}]}]},createdAt:'2026-10-01T00:00:00Z',updatedAt:'2026-10-01T00:00:00Z',reviewDate:'2026-10-02',revisions:[]})
const review=(patch:Partial<Reflection>={}):Reflection=>({at:'2026-10-16T00:00:00Z',outcome:'maintain',result:'새 증거',lesson:'',nextAction:'',...patch})
test('review lifecycle orders due first, preserves condition waiting, closes and reopens using absolute time',()=>{
 const closed={...base('closed'),reflections:[review({at:'2026-10-16T10:00:00+09:00',outcome:'close',judgement:'종료 판단'})]}
 expect(reviewStatus(closed,'2026-10-16')).toBe('closed')
 const reopened={...closed,id:'reopened',reviewDate:'',reflections:[...closed.reflections,review({at:'2026-10-16T02:00:00Z',trigger:'다음 실적',judgement:'새 가설'})]}
 expect(latestReview(reopened)?.trigger).toBe('다음 실적');expect(currentJudgement(reopened)).toBe('새 가설');expect(reviewStatus(reopened,'2026-10-16')).toBe('planned')
 expect(reviewStatus({...base(),reviewDate:'2026-10-17'},'2026-10-16')).toBe('planned');expect(reviewStatus(base(),'2026-10-16')).toBe('due')
 expect(reviewStatus({...base(),reviewDate:'',reflections:[review()]},'2026-10-16')).toBe('done')
 expect(currentJudgement({...reopened,reflections:[...reopened.reflections,review({at:'2026-10-16T03:00:00Z'})]})).toBe('새 가설')
 expect([closed,{...base(),id:'due'},reopened].sort(reviewOrder).map(e=>e.id)).toEqual(['due','reopened','closed'])
 const entries=[{...reopened,revisions:[{at:base().updatedAt,snapshot:snapshot(base())}],reflections:[...reopened.reflections,review({at:'2026-10-17T00:00:00Z',previousJudgement:'새 가설',judgement:'다음 가설',nextReviewDate:'2026-11-01'})]}]
 const restored=parseNotebook(JSON.stringify({format:'folio-journal',version:1,entries}));expect(JSON.parse(JSON.stringify(restored))).toEqual(JSON.parse(JSON.stringify(entries)))
})
test('mixed date and condition schedules have one stable priority order',()=>{
 const a={...base('a'),reviewDate:'2099-01-01',updatedAt:'2026-01-01T00:00:00Z'},b={...base('b'),reviewDate:'',updatedAt:'2026-02-01T00:00:00Z',reflections:[review({trigger:'새 자료'})]},c={...base('c'),reviewDate:'2099-02-01',updatedAt:'2026-03-01T00:00:00Z'}
 for(const entries of [[a,b,c],[a,c,b],[b,a,c],[b,c,a],[c,a,b],[c,b,a]])expect(entries.sort(reviewOrder).map(e=>e.id)).toEqual(['a','c','b'])
})
async function setup(page:Page){
 await page.addInitScript(()=>sessionStorage.setItem('peppercorn-intro-seen','1'))
 await page.route('**/functions/v1/leaderboard?*',r=>r.fulfill({json:{rows:demoRows}}));await page.route('**/functions/v1/position-public?*',r=>r.fulfill({json:{rows:[]}}))
 await page.goto('/peppercorn/');await openPage(page,'저널');await expect(page.getByRole('button',{name:'새 페이지',exact:true})).toBeEnabled()
 await page.evaluate(e=>new Promise<void>(resolve=>{const r=indexedDB.open('folio-lifetime-journal',1);r.onsuccess=()=>{const t=r.result.transaction('notebooks','readwrite');t.objectStore('notebooks').put([e],'guest');t.oncomplete=()=>resolve()}}),base())
 await page.reload();await openPage(page,'여정')
}
async function stored(page:Page){return page.evaluate(()=>new Promise<JournalEntry>(resolve=>{const r=indexedDB.open('folio-lifetime-journal',1);r.onsuccess=()=>{const q=r.result.transaction('notebooks').objectStore('notebooks').get('guest');q.onsuccess=()=>resolve(q.result[0])}}))}
test('queue opens dedicated review, chains changed judgements, retains original and terminates scheduling',async({page})=>{
 await setup(page);await expect(page.locator('.decision-queue-item')).toHaveCount(1);await expect(page.locator('.decision-queue .journal-story,.decision-queue img')).toHaveCount(0)
 await page.getByRole('button',{name:'재판단하기',exact:true}).click();await expect(page.getByLabel('이번 점검의 기준')).toContainText('기존 가설');await expect(page.getByRole('textbox',{name:'기록 제목'})).toHaveCount(0)
 await page.getByRole('button',{name:'판단 저장',exact:true}).click();await expect(page.getByRole('alert')).toContainText('증거')
 await page.getByLabel('회고 결과',{exact:true}).fill('매출 증가 확인');await page.getByLabel('회고 판단',{exact:true}).selectOption('revise');await page.getByRole('button',{name:'판단 저장',exact:true}).click();await expect(page.getByRole('alert')).toContainText('이전 판단과 다르게')
 await page.getByLabel('바뀐 판단').fill('수익성도 함께 확인한다');await page.getByRole('button',{name:'판단 저장',exact:true}).click();await expect(page.getByRole('alert')).toContainText('조건이나 날짜')
 await page.getByLabel('다음 점검 조건').fill('다음 분기 실적 발표');await page.getByRole('button',{name:'판단 저장',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0)
 await expect(page.locator('.decision-queue-judgement')).toHaveText('수익성도 함께 확인한다');const updated=await stored(page);expect(updated.text).toBe('원본 본문');expect(updated.hypothesis).toBe('기존 가설');expect(updated.reflections?.[0]).toMatchObject({previousJudgement:'기존 가설',judgement:'수익성도 함께 확인한다',trigger:'다음 분기 실적 발표'})
 await page.getByLabel('내 기록 검색').fill('다음 분기');await expect(page.locator('.decision-queue-item')).toHaveCount(1)
 await page.getByRole('button',{name:'재판단하기',exact:true}).click();await expect(page.getByLabel('이번 점검의 기준')).toContainText('수익성도 함께 확인한다');await page.getByLabel('회고 결과',{exact:true}).fill('검토할 이유가 사라졌다');await page.getByLabel('회고 판단',{exact:true}).selectOption('close');await page.getByRole('button',{name:'판단 저장',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0)
 await page.getByLabel('내 기록 검색').fill('');await expect(page.locator('.decision-status')).toHaveText('검토 종료');expect((await stored(page)).reviewDate).toBe('')
 await openPage(page,'오늘');await expect(page.locator('.home-journey-state')).toContainText('다시 볼 생각 0개');await page.getByRole('button',{name:'여정 카드 열기',exact:true}).click();await expect(page.locator('.home-digest')).toContainText('점검 중인 판단이 없습니다.');await page.keyboard.press('Escape');await openPage(page,'여정');
 await page.getByRole('button',{name:'검토 다시 열기',exact:true}).click();await page.getByLabel('회고 결과',{exact:true}).fill('새 자료로 다시 검토');await page.getByLabel('회고 다음 점검일').fill('2099-01-01');await page.getByRole('button',{name:'판단 저장',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0)
 await expect(page.locator('.decision-status')).toHaveText('점검 예정');expect((await stored(page)).reflections).toHaveLength(3)
})
for(const width of [390,834,1366,1440])for(const theme of ['light','dark'])test(`reassessment writing ${width} ${theme}: evidence first, optional notes and reachable save`,async({browser})=>{
 const context=await browser.newContext({viewport:{width,height:width===390?844:width===834?1194:width===1366?1024:900},hasTouch:width<1440,reducedMotion:'reduce'}),page=await context.newPage();await page.addInitScript(t=>localStorage.setItem('folio-theme',t),theme);await setup(page)
 await expect(page.getByRole('button',{name:'재판단하기',exact:true})).toBeInViewport();const action=(await page.getByRole('button',{name:'재판단하기',exact:true}).boundingBox())!,nav=await page.locator('.mobile-bottom-nav').boundingBox();expect(action.y+action.height).toBeLessThanOrEqual(nav?.y||page.viewportSize()!.height);await page.getByRole('button',{name:'재판단하기',exact:true}).click();await expect(page.getByLabel('이번 점검의 기준')).toHaveCount(1);await expect(page.locator('.decision-notes .notebook-paper')).not.toBeVisible()
 await page.getByLabel('회고 결과',{exact:true}).fill('새 사실을 먼저 확인합니다.');await page.screenshot({path:`test-results/decision-writing-${width}-${theme}.png`})
 await page.getByLabel('다음 점검 조건').fill('다음 공개 자료 확인');const save=page.getByRole('button',{name:'판단 저장',exact:true});await expect(save).toBeInViewport()
 const rect=(await save.boundingBox())!;expect(rect.height).toBeGreaterThanOrEqual(44);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
 await save.click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('.decision-status')).toHaveText('점검 예정');await context.close()
})
