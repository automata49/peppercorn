import {expect,type Page} from '@playwright/test'
export async function openStockSearch(page:Page){
 const magnifier=page.locator('.mobile-brand-search:visible').first()
 await expect(magnifier).toBeVisible()
 await magnifier.click()
 const dialog=page.getByRole('dialog',{name:'종목 검색'})
 await expect(dialog).toBeVisible()
 return dialog
}
export async function openPage(page:Page,label:string){
 await expect(page.locator('.shell:not([inert])')).toBeVisible()
 label=({홈:'시장 요약',탐색:'발견',추적:'여정',Journal:'매매 기록'} as Record<string,string>)[label]||label
 const side=page.locator('.sidebar nav').getByRole('button',{name:label,exact:true})
 const quick=page.locator('.mobile-bottom-nav').getByRole('button',{name:label,exact:true})
 if(await side.isVisible())await side.click()
 else if(await quick.isVisible())await quick.click()
 else {
   const tools=page.locator('.sidebar-tools')
   if(await tools.isVisible())await tools.click()
   else await page.getByRole('button',{name:'전체 메뉴 열기',exact:true}).first().click()
   await page.locator('.menu-drawer').getByRole('button',{name:label,exact:true}).click()
   await expect(page.locator('.menu-drawer')).toHaveCount(0)
 }
 // Older detail/chart regressions opt into the retained card view explicitly.
 // The customer-facing default remains the compact one-line list.
 if(label==='발견'){
   const toggle=page.getByRole('group',{name:'종목 보기 방식'})
   await expect(toggle).toBeVisible()
   await toggle.getByRole('button',{name:'카드형'}).click()
 }
}
export async function openSignal(page:Page){await openPage(page,'시장 신호');await expect(page.locator('.dashboard-sector-panel')).toBeVisible()}
export async function openLeaderTools(page:Page){await openSignal(page);await page.locator('.leader-tools-trigger').click()}
export async function pickFirstStock(page:Page){
 await page.locator('[data-wheel="분류"]').getByRole('button',{name:'전체',exact:true}).click()
 await page.locator('[data-wheel="주도 분류"]').getByRole('button',{name:'전체',exact:true}).click()
 await page.locator('.analysis-idea-list .stock-trend-row').first().click()
}
export async function backToExplore(page:Page){await page.getByRole('button',{name:'뒤로 가기'}).click()}

export async function openFilters(page:Page){
 await expect(page.locator('.catalog-filter-rails')).toBeVisible()
}
export async function closeFilters(page:Page){
 if(await page.locator('.catalog-filter-drawer.ui-dialog-content').count())await page.getByRole('button',{name:'필터 닫기'}).click()
}
