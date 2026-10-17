import { test, expect } from '@playwright/test'
import { openPage } from './journey-helpers'
const SESSION={access_token:'synthetic-notebook-user',refresh_token:'synthetic-refresh',expires_at:9999999999,user:{id:'synthetic-user',email:'tester@example.com'}}

test('typing @ asks AI inside the note and inserts an editable draft without a separate AI section',async({page})=>{
 await page.addInitScript(session=>{
  sessionStorage.setItem('peppercorn-intro-seen','1')
  localStorage.setItem('peppercorn-session',JSON.stringify(session))
 },SESSION)
 let saved:any=null, calls=0
 await page.route('**/functions/v1/notebook*',route=>{
  if(route.request().method()==='POST'){saved=route.request().postDataJSON();return route.fulfill({json:{entries:saved.entries}})}
  return route.fulfill({json:{entries:[]}})
 })
 await page.route('**/functions/v1/workspace?*',route=>route.fulfill({json:{rows:[]}}))
 await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows:[]}}))
 await page.route('**/functions/v1/position-public?*',route=>route.fulfill({json:{rows:[]}}))
 await page.route('**/functions/v1/journal-ai',route=>{
  calls++
  const sent=route.request().postDataJSON()
  expect(sent.messages.at(-1)).toEqual({role:'user',content:'테슬라 로드스터 발표가 주가에 미칠 영향은?'})
  expect(sent.context).toContain('로드스터')
  return route.fulfill({json:{reply:'발표 시점과 양산 가능성을 분리하여 검증하세요.\n실적에 반영될 규모도 확인하세요.'}})
 })
 await page.goto('/peppercorn/')
 await openPage(page,'저널')
 await page.getByRole('button',{name:'새 페이지',exact:true}).click()
 await expect(page.locator('.journal-ai-disclosure')).toHaveCount(0)
 await expect(page.getByRole('heading',{name:'AI와 생각 정리'})).toHaveCount(0)
 await page.getByLabel('기록 제목').fill('AI 통합 노트')
 const body=page.getByRole('textbox',{name:'기록 본문',exact:true})
 await body.fill('내 가설\n')
 await body.focus()
 await page.keyboard.press('End')
 await page.keyboard.insertText('@테슬라 로드스터 발표가 주가에 미칠 영향은?')
 await expect(page.getByRole('status',{name:'노트 AI 명령'})).toBeVisible()
 await page.keyboard.press('Enter')
 await expect(body.locator('blockquote')).toContainText('발표 시점과 양산 가능성을 분리하여 검증하세요.')
 await expect(body.locator('blockquote')).toContainText('실적에 반영될 규모')
 await expect(body).not.toContainText('@테슬라')
 expect(calls).toBe(1)
 await page.getByRole('button',{name:'페이지 저장',exact:true}).click()
 await expect(page.getByRole('dialog')).toHaveCount(0)
 await expect.poll(()=>saved?.entries?.[0]?.text||'').toContain('실적에 반영될 규모')
 expect(saved.entries[0].aiMessages).toHaveLength(2)
})

test('model error leaves the author\'s @ question intact for retry',async({page})=>{
 await page.addInitScript(session=>{
  sessionStorage.setItem('peppercorn-intro-seen','1')
  localStorage.setItem('peppercorn-session',JSON.stringify(session))
 },SESSION)
 await page.route('**/functions/v1/notebook*',route=>route.fulfill({json:{entries:[]}}))
 await page.route('**/functions/v1/workspace?*',route=>route.fulfill({json:{rows:[]}}))
 await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows:[]}}))
 await page.route('**/functions/v1/position-public?*',route=>route.fulfill({json:{rows:[]}}))
 let attempted=0
 await page.route('**/functions/v1/journal-ai',route=>{attempted++;return route.fulfill({status:502,json:{error:'model_unavailable'}})})
 await page.goto('/peppercorn/')
 await openPage(page,'저널')
 await page.getByRole('button',{name:'새 페이지',exact:true}).click()
 const body=page.getByRole('textbox',{name:'기록 본문',exact:true})
 await body.focus()
 await page.keyboard.insertText('@투자 위험을 분석해줘')
 await expect(page.getByRole('status',{name:'노트 AI 명령'})).toBeVisible()
 await page.getByRole('button',{name:'노트에 작성 ↵'}).click()
 await expect.poll(()=>attempted,{message:'AI request must be sent by inline button'}).toBeGreaterThan(0)
 await expect(page.getByRole('alert')).toContainText('AI 모델 응답이 실패했습니다.')
 await expect(body).toContainText('@투자 위험을 분석해줘')
 await expect(body.locator('blockquote')).toHaveCount(0)
 await expect(body).toHaveAttribute('contenteditable','true')
})
