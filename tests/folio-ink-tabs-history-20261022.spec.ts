import {test,expect} from '@playwright/test'
import {inkPreviewBox} from '../src/components/InkPad'

test('read-only ink crops saved paper coordinates while card preview preserves paper',()=>{
 const strokes=[[{x:370,y:1250,tool:'pencil' as const,size:3,pressure:.5},{x:575,y:1270,tool:'pencil' as const,size:3,pressure:.5}]]
 expect(inkPreviewBox(strokes,true)).toBe('346 1226 320 68')
 expect(inkPreviewBox(strokes)).toBe('0 0 1000 1290')
})
test('Discovery/Journey tabs share responsive ink underline and browser Back restores Discover tab',async({page})=>{
 await page.addInitScript(()=>sessionStorage.setItem('peppercorn-intro-seen','1'))
 await page.goto('/peppercorn/')
 const nav=async(label:string)=>{
  const side=page.locator('.sidebar nav').getByRole('button',{name:label,exact:true})
  const bottom=page.locator('.mobile-bottom-nav').getByRole('button',{name:label,exact:true})
  if(await side.isVisible())await side.click();else await bottom.click()
 }
 await nav('발견')
 const tabs=page.getByRole('tablist',{name:'발견 영역'})
 await expect(tabs.getByRole('tab')).toHaveText(['시장 신호','종목 검토','리서치 기록'])
 await tabs.getByRole('tab',{name:'종목 검토'}).click()
 await expect(tabs.getByRole('tab',{name:'종목 검토'})).toHaveAttribute('data-state','active')
 await page.evaluate(()=>history.back())
 await expect(tabs.getByRole('tab',{name:'시장 신호'})).toHaveAttribute('data-state','active')
 for(const item of await tabs.getByRole('tab').all()){
  expect(parseFloat(await item.evaluate(el=>getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(15)
  expect((await item.boundingBox())!.height).toBeGreaterThanOrEqual(44)
 }
 await nav('여정')
 const journey=page.getByRole('tablist',{name:'여정 영역'})
 await expect(journey.getByRole('tab')).toHaveText(['재검토','관심종목','보유종목'])
 await journey.getByRole('tab',{name:'관심종목'}).click()
 await expect(journey.getByRole('tab',{name:'관심종목'})).toHaveAttribute('data-state','active')
 await page.evaluate(()=>history.back())
 await expect(journey.getByRole('tab',{name:'재검토'})).toHaveAttribute('data-state','active')
})
