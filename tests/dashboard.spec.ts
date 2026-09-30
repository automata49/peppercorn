import {test,expect} from '@playwright/test'
const rows=Array.from({length:20},(_,i)=>({id:String(i),ticker:'TEST'+i,market:i%2?'KR':'US',name:'검증 종목 '+i,asset_class:'Equity',sector:i%2?'Electronic Technology':'Technology',industry:'Semiconductors',exchange:i%2?'KOSPI':'NASDAQ',index_memberships:[i%2?'KOSPI200':'S&P 500'],price:100+i,rs_rank:99-i%4,ibd_rs_estimate:95,high_52w_distance:-.1,leader_tt:true,leadership_class:'핵심 주도',stage:'▲ 돌파',rs_3m:.1,rs_6m:.2,rs_5d:.01,rs_20d:.02,rs_50d:.03,rs_120d:.04,rs_200d:.05,rs_12m:.06,ma50:90,ma200:80,return_1w:.01,return_5d:.01,return_20d:.02,return_50d:.03,return_120d:.04,return_200d:.05,return_12m:.06,action_guide:'테스트 전용'}))
const etfs=Array.from({length:7},(_,i)=>({...rows[0],id:'etf-'+i,ticker:'ETF'+i,market:'US',name:'검증 ETF '+i,asset_class:'ETF',sector:'Information Technology',rs_rank:null,ibd_rs_estimate:null,leader_tt:false,leadership_class:'중립',rs_1m:i===6?null:i/100,rs_3m:i===6?null:i/100,rs_6m:null,rs_12m:null,high_52w_distance:i===6?null:-.02*i}))
for(const view of [{name:'phone',width:390,height:844,touch:true},{name:'ipad-portrait',width:834,height:1194,touch:true},{name:'ipad-landscape',width:1194,height:834,touch:true},{name:'ipad-pro',width:1366,height:1024,touch:true},{name:'desktop',width:1440,height:900,touch:false}]){
 test(view.name+' layout and stock parity',async({browser})=>{
  const context=await browser.newContext({viewport:{width:view.width,height:view.height},hasTouch:view.touch,isMobile:view.touch});
  const page=await context.newPage();
  await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows:[...rows,...etfs]}}));
  await page.goto('http://127.0.0.1:4173/peppercorn/');
  await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000});
  await expect(page.locator('.dashboard-sector-panel .dashboard-sector-table tbody tr')).toHaveCount(2);
  const etfPanel=page.locator('.dashboard-etf-panel');
  await expect(etfPanel.locator('tbody tr')).toHaveCount(5);
  await expect(etfPanel.locator('tbody tr td:first-child b')).toHaveText(['검증 ETF 5','검증 ETF 4','검증 ETF 3','검증 ETF 2','검증 ETF 1']);
  await expect(etfPanel.locator('tbody tr').first().locator('td').nth(1)).toHaveText('99');
  await expect(etfPanel.locator('tbody tr').first().locator('td').last()).toHaveText('-10.0%');
  expect(await etfPanel.locator('thead th:not(:first-child)').evaluateAll(es=>es.filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.textContent))).toEqual([]);
  expect(await etfPanel.locator('thead th').first().evaluate(e=>getComputedStyle(e).fontSize)).toBe(await page.locator('.dashboard-sector-panel .sector-metrics-table th').first().evaluate(e=>getComputedStyle(e).fontSize));
  const etfWrap=etfPanel.locator('.dashboard-sector-table-wrap');
  await etfWrap.evaluate(e=>{e.scrollLeft=200});
  expect(Math.abs((await etfPanel.locator('.sector-name-head').boundingBox())!.x-(await etfWrap.boundingBox())!.x)).toBeLessThan(6);
  await etfWrap.evaluate(e=>{e.scrollLeft=0});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBeTruthy();
  const panel=page.locator('.dashboard-stock-panel');
  if(view.width>=1280){
   await expect(panel).toBeVisible();
   const sectorBox=await page.locator('.dashboard-sector-panel').boundingBox();const stockBox=await panel.boundingBox();
   expect(stockBox!.x).toBeGreaterThan(sectorBox!.x+sectorBox!.width);
   const headFont=await panel.locator('.stock-rows-head').evaluate(e=>getComputedStyle(e).fontSize);
   expect(headFont).toBe(await page.locator('.sector-metrics-table th').first().evaluate(e=>getComputedStyle(e).fontSize));
   for(const period of ['5D','20D','50D','120D','200D','52W'])await expect(panel.locator('.stock-rows-head').getByText('등락 '+period,{exact:true})).toBeVisible();
   const heads=panel.locator('.stock-rows-head > span');
   expect(await heads.evaluateAll(es=>es.map(e=>({text:e.textContent,width:e.clientWidth,scroll:e.scrollWidth})).filter(e=>e.scroll>e.width+1))).toEqual([]);
   await expect(panel.locator('.stock-row').first().locator('span').last()).toHaveText('-10.0%');
   await page.locator('.dashboard-sector-panel .dashboard-sector-table tbody tr').first().click();
   await expect(page.locator('.drill-sheet')).toHaveCount(0);
   const scroll=panel.locator('.stock-rows');
   await scroll.evaluate(e=>{e.scrollTop=100;e.scrollLeft=200});
   const frozen=await panel.locator('.stock-name-head').boundingBox();const box=await scroll.boundingBox();
   expect(Math.abs(frozen!.x-box!.x)).toBeLessThan(6);
   await scroll.evaluate(e=>{e.scrollTop=0;e.scrollLeft=0});
   const resize=panel.getByRole('button',{name:'종목 열 너비 조절'});
   const handle=await resize.boundingBox();
   await page.mouse.move(handle!.x+handle!.width/2,handle!.y+handle!.height/2);
   await page.mouse.down();await page.mouse.move(handle!.x+handle!.width/2+40,handle!.y+handle!.height/2);await page.mouse.up();
   expect(await panel.locator('.stock-name-head').evaluate(e=>e.getBoundingClientRect().width)).toBeGreaterThan(102);
   await panel.locator('.stock-row').first().focus();await page.keyboard.press('Enter');
  }else{
   await expect(panel).toBeHidden();
   const cards=page.locator('.market-metric-card');const b=await cards.evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y}}));
   expect(b[0].y).toBe(b[2].y);expect(b[3].y).toBe(b[4].y);expect(b[3].y).toBeGreaterThan(b[0].y);
   await page.locator('.dashboard-sector-panel .dashboard-sector-table tbody tr').first().click();
   await expect(page.locator('.drill-sheet')).toBeVisible();
   await page.locator('.drill-sheet .stock-row').first().click();
  }
  const rsSection=page.locator('.drill-sheet .snapshot-section').filter({has:page.getByRole('heading',{name:'상대강도'})});
  await expect(rsSection.locator('.signal-strip strong')).toHaveText(['+1.0%','+2.0%','+3.0%','+4.0%','+5.0%','+6.0%']);
  await expect(page.getByRole('button',{name:'종목분석 기록 작성 →'})).toBeVisible();
  await page.getByRole('button',{name:'닫기',exact:true}).click();
  await expect(page.locator('.drill-sheet')).toHaveCount(0);
  await etfPanel.getByRole('button',{name:'전체 보기 →'}).click();
  const etfDialog=page.locator('.etf-summary-dialog');
  await expect(etfDialog.locator('tbody tr')).toHaveCount(7);
  await expect(etfDialog.locator('tbody tr').last().locator('td').nth(1)).toHaveText('—');
  await expect(etfDialog.locator('tbody tr').last().locator('td').last()).toHaveText('—');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBeTruthy();
  await etfDialog.locator('tbody tr').first().click();
  await expect(etfDialog).toHaveCount(0);
  await expect(page.locator('.drill-sheet .leadership-score').first()).toContainText('ETF RS순위');
  await expect(page.locator('.drill-sheet .leadership-score').first()).toContainText('99');
  await page.getByRole('button',{name:'닫기',exact:true}).click();
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:`test-results/${view.name}.png`,fullPage:true});
  await context.close();
 })
}

test('RS bands refresh in an already open stock detail',async({page})=>{
  let calls=0;
  await page.route('**/functions/v1/leaderboard?*',route=>{
    calls++;
    route.fulfill({json:{rows:rows.map(r=>({...r,rs_5d:calls===1?null:'0.11'}))}});
  });
  await page.goto('http://127.0.0.1:4173/peppercorn/');
  await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000});
  await page.locator('.dashboard-stock-panel .stock-row').first().click();
  const rs=page.locator('.drill-sheet .snapshot-section').filter({has:page.getByRole('heading',{name:'상대강도'})});
  await expect(rs.locator('.signal-strip strong').first()).toHaveText('—');
  await page.getByRole('button',{name:'RS 새로고침'}).click();
  await expect(rs.locator('.signal-strip strong').first()).toHaveText('+11.0%');
  await expect(page.locator('.drill-sheet .drill-meta')).toContainText('TEST0');
  expect(calls).toBe(2);
});

test('ETF detail shows relative strength without equity-only rankings',async({page})=>{
  const etf={...rows[0],id:'etf-spy',ticker:'SPY',name:'SPY ETF',asset_class:'ETF',rs_rank:null,ibd_rs_estimate:null,ibd_rs_as_of:null,leader_tt:false,leadership_class:'중립'};
  await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows:[etf]}}));
  await page.goto('http://127.0.0.1:4173/peppercorn/');
  await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000});
  await page.locator('.sidebar nav').getByRole('button',{name:'종목 분석'}).click();
  await expect(page.locator('.analysis-card .stock-title')).toContainText('SPY ETF');
  const rs=page.locator('.analysis-card .snapshot-section').filter({has:page.getByRole('heading',{name:'상대강도'})});
  await expect(rs.locator('.signal-strip strong')).toHaveText(['+1.0%','+2.0%','+3.0%','+4.0%','+5.0%','+6.0%']);
  await expect(page.locator('.analysis-card .leadership-score').first()).toContainText('ETF RS순위99');
  await expect(page.locator('.analysis-card .ibd-score')).toHaveAttribute('title','ETF 등 주식 외 자산은 IBD식 RS 산정 대상이 아닙니다');
  await expect(page.locator('.analysis-card .checklist label').filter({hasText:'Trend Template'}).locator('b')).toHaveText('해당 없음');
  await expect(page.locator('.analysis-card .checklist label').filter({hasText:'RS순위 ≥ 70'}).locator('b')).toHaveText('해당 없음');
});

test('failed live load can be retried from the demo state',async({page})=>{
  let calls=0;
  await page.route('**/functions/v1/leaderboard?*',route=>{
    calls++;
    calls===1?route.fulfill({status:503,body:'unavailable'}):route.fulfill({json:{rows}});
  });
  await page.goto('http://127.0.0.1:4173/peppercorn/');
  await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000});
  await expect(page.getByRole('button',{name:'시장 데이터 새로고침'})).toContainText('Demo / Local');
  await page.getByRole('button',{name:'시장 데이터 새로고침'}).click();
  await expect(page.getByRole('button',{name:'시장 데이터 새로고침'})).toContainText('Supabase Live');
  expect(calls).toBe(2);
});

test('a stalled live response releases the refresh controls',async({page})=>{
  let calls=0;
  await page.route('**/functions/v1/leaderboard?*',route=>{
    calls++;
    if(calls>1)void route.fulfill({json:{rows}});
  });
  await page.goto('http://127.0.0.1:4173/peppercorn/');
  const refresh=page.getByRole('button',{name:'시장 데이터 새로고침'});
  await expect(refresh).toBeEnabled({timeout:17_000});
  await expect(refresh).toContainText('Demo / Local');
  await refresh.click();
  await expect(refresh).toContainText('Supabase Live');
  expect(calls).toBe(2);
});

test('KR ETFs show their Korean name in the dashboard ETF summary and detail',async({page})=>{
  const kr={...rows[1],id:'etf-kr',ticker:'069500',market:'KR',name:'Samsung KODEX 200 Securities ETF',asset_class:'ETF',rs_rank:null,ibd_rs_estimate:null,leader_tt:false,leadership_class:'중립'};
  await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows:[...rows,kr]}}));
  await page.goto('http://127.0.0.1:4173/peppercorn/');
  await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000});
  const row=page.locator('.dashboard-etf-panel tbody tr').first();
  await expect(row.locator('td:first-child b')).toHaveText('KODEX 200');
  await row.click();
  await expect(page.locator('.drill-sheet h2').first()).toHaveText('KODEX 200');
});
