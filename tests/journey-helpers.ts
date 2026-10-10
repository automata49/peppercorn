import {expect,type Page} from '@playwright/test'
export async function openPage(page:Page,label:string){
 label=({홈:'시장 요약',탐색:'발견',추적:'여정',Journal:'매매 기록'} as Record<string,string>)[label]||label
 const side=page.locator('.sidebar nav').getByRole('button',{name:label,exact:true})
 if(await side.isVisible())return side.click()
 const quick=page.locator('.mobile-bottom-nav').getByRole('button',{name:label,exact:true})
 if(await quick.isVisible())return quick.click()
 await page.getByRole('button',{name:'전체 메뉴 열기',exact:true}).first().click()
 await page.locator('.menu-drawer').getByRole('button',{name:label,exact:true}).click()
 await expect(page.locator('.menu-drawer')).toHaveCount(0)
}
export async function openSignal(page:Page){await openPage(page,'시장 신호');await expect(page.locator('.dashboard-sector-panel')).toBeVisible()}
export async function openLeaderTools(page:Page){await openSignal(page);await page.locator('.leader-tools-trigger').click()}
export async function pickFirstStock(page:Page){const scope=page.locator('.analysis-scope');const active=scope.locator('button[aria-pressed="true"]');if(await active.count())await active.first().click();await page.locator('.analysis-idea-list > button').first().click()}
export async function backToExplore(page:Page){await page.getByRole('button',{name:'← 탐색 목록',exact:true}).click()}
