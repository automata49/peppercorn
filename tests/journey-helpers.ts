import {expect,type Page} from '@playwright/test'
export async function openPage(page:Page,label:string){
 const side=page.locator('.sidebar nav').getByRole('button',{name:label,exact:true})
 if(await side.isVisible())return side.click()
 const quick=page.locator('.mobile-bottom-nav').getByRole('button',{name:label,exact:true})
 if(await quick.isVisible())return quick.click()
 await page.getByRole('button',{name:'전체 메뉴 열기',exact:true}).first().click()
 await page.locator('.menu-drawer').getByRole('button',{name:label,exact:true}).click()
}
export async function openSignal(page:Page){await openPage(page,'시장 신호');await expect(page.locator('.dashboard-sector-panel')).toBeVisible()}
export async function openLeaderTools(page:Page){await openSignal(page);await page.locator('.leader-tools-trigger').click()}
export async function pickFirstStock(page:Page){await page.locator('.analysis-scope').getByRole('tab',{name:'전체',exact:true}).click();await page.locator('.analysis-idea-list > button').first().click()}
export async function backToExplore(page:Page){await page.getByRole('button',{name:'← 탐색 목록',exact:true}).click()}
