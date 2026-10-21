import { test, expect, type Page } from '@playwright/test'
import { parseReports, parseReportDetail } from '../src/lib/sourceReports'
import { openPage } from './journey-helpers'
const uid='10000000-0000-0000-0000-000000000001'
const id='fixture_report_12345'
const report={drive_file_id:id,title:'테스트 리서치 리포트',source_url:`https://drive.google.com/file/d/${id}/view`,source_modified_at:'2026-10-15T02:00:00Z',imported_at:'2026-10-15T02:05:00Z',content_hash:'a'.repeat(64),summary:['기준 시각이 서로 다른 자료입니다.','가격과 사업 변화를 구분합니다.']}
const detail={...report,pages:[{number:1,text:'리포트 전문 테스트 문장입니다.\n주문·출하·마진을 확인합니다.',images:[]}],links:[{label:'회사 발표',url:'https://example.com/source'}]}
async function boot(page:Page){
 await page.addInitScript(uid=>{sessionStorage.setItem('peppercorn-intro-seen','1');localStorage.setItem('peppercorn-session',JSON.stringify({access_token:'test-access',refresh_token:'test-refresh',expires_at:9999999999,user:{id:uid}}))},uid)
 await page.route('**/functions/v1/workspace?*',r=>r.fulfill({json:{rows:[]}}))
 await page.route('**/functions/v1/source-reports*',r=>r.fulfill({json:{rows:r.request().url().includes('?id=')?[detail]:[report]}}))
 await page.goto('/peppercorn/')
}
test('source-report parser rejects unsafe sources, images and oversized contents',()=>{
 expect(parseReports([report])).toHaveLength(1)
 expect(parseReports([{...report,source_url:'https://evil.example/report'}])).toHaveLength(0)
 expect(parseReportDetail(detail).pages[0].text).toContain('전문')
 expect(()=>parseReportDetail({...detail,links:[{label:'bad',url:'javascript:alert(1)'}]})).toThrow()
 expect(()=>parseReportDetail({...detail,pages:[{...detail.pages[0],images:['data:image/svg+xml;base64,AAAA']}]})).toThrow()
})
for(const width of [390,834,1440])test(`Reports move to MARKET & COMPANIES ${width}`,async({page})=>{
 await page.setViewportSize({width,height:1000});await boot(page)
 let detailRequests=0;page.on('request',r=>{if(r.url().includes('/source-reports?id='))detailRequests++})
 await page.getByRole('button',{name:'오늘 카드 열기'}).click()
 await expect(page.getByRole('region',{name:'Folio 리서치 리포트'})).toHaveCount(0)
 await page.getByRole('button',{name:'카드 닫기',exact:true}).click()
 await page.getByRole('button',{name:'저널 카드 열기'}).click()
 await expect(page.getByRole('region',{name:'Folio 리서치 리포트'})).toHaveCount(0)
 await page.getByRole('button',{name:'카드 닫기',exact:true}).click()
 await openPage(page,'저널')
 await expect(page.getByRole('region',{name:'Folio 리서치 리포트'})).toHaveCount(0)
 await openPage(page,'발견')
 await expect(page.getByRole('region',{name:'시장과 종목의 최신 뉴스'})).toHaveCount(0)
 await page.getByRole('tab',{name:'시장 신호'}).click()
 const section=page.getByRole('region',{name:'시장과 종목의 최신 뉴스'})
 const tabs=section.getByRole('group',{name:'시장과 기업 보기'})
 await expect(tabs.getByRole('button',{name:'리포트'})).toHaveAttribute('aria-pressed','true')
 const reports=section.getByRole('region',{name:'Folio 리서치 리포트'})
 await expect(reports).toContainText(report.title);await expect(reports).toContainText(report.summary[0]);expect(detailRequests).toBe(0)
 await reports.getByRole('button',{name:'전문·차트 읽기'}).click()
 await expect(reports.getByLabel('리포트 전문')).toContainText('주문·출하·마진')
 await expect(reports.getByRole('link',{name:'원본 PDF ↗'})).toHaveAttribute('href',report.source_url)
 await section.locator('[data-wheel="종목 분류"]').getByRole('button',{name:'대형주'}).click()
 await expect(section.getByRole('region',{name:'Folio 리서치 리포트'})).toHaveCount(0)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
})
test('guest does not request private reports',async({page})=>{
 let requests=0;page.on('request',r=>{if(r.url().includes('/source-reports'))requests++})
 await page.goto('/peppercorn/');await expect(page.getByRole('button',{name:'오늘 카드 열기'})).toBeVisible();expect(requests).toBe(0)
})
test('late previous-account report response cannot cross accounts',async({page})=>{
 await page.addInitScript(uid=>{sessionStorage.setItem('peppercorn-intro-seen','1');localStorage.setItem('peppercorn-session',JSON.stringify({access_token:'old',refresh_token:'refresh',expires_at:9999999999,user:{id:uid}}))},uid)
 await page.route('**/functions/v1/workspace?*',r=>r.fulfill({json:{rows:[]}}))
 let release!:()=>void;const gate=new Promise<void>(r=>{release=r})
 await page.route('**/functions/v1/source-reports*',async r=>{if(r.request().headers().authorization==='Bearer old'){await gate;await r.fulfill({json:{rows:[report]}}).catch(()=>{})}else await r.fulfill({json:{rows:[]}})})
 await page.goto('/peppercorn/');await openPage(page,'발견');await page.getByRole('tab',{name:'시장 신호'}).click();await page.getByRole('region',{name:'시장과 종목의 최신 뉴스'}).getByRole('button',{name:'리포트',exact:true}).click()
 await page.evaluate(()=>{const value=JSON.stringify({access_token:'new',refresh_token:'refresh',expires_at:9999999999,user:{id:'20000000-0000-0000-0000-000000000002'}});localStorage.setItem('peppercorn-session',value);window.dispatchEvent(new StorageEvent('storage',{key:'peppercorn-session',newValue:value}))})
 release();await expect(page.getByText(report.title,{exact:true})).toHaveCount(0)
})
