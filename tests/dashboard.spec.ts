import {openSignal,openPage,pickFirstStock} from './journey-helpers'
import {test,expect} from '@playwright/test'
const rows=Array.from({length:20},(_,i)=>({id:String(i),ticker:'TEST'+i,market:i%2?'KR':'US',name:'검증 종목 '+i,asset_class:'Equity',sector:i%2?'Electronic Technology':'Technology',industry:'Semiconductors',exchange:i%2?'KOSPI':'NASDAQ',index_memberships:[i%2?'KOSPI200':'S&P 500'],price:100+i,rs_rank:99-i%4,ibd_rs_estimate:95,high_52w_distance:-.1,leader_tt:true,leadership_class:'핵심 주도',stage:'▲ 돌파',rs_3m:.1,rs_6m:.2,rs_5d:.01,rs_20d:.02,rs_50d:.03,rs_120d:.04,rs_200d:.05,rs_12m:.06,ma50:90,ma200:80,return_1w:.01,return_5d:.01,return_20d:.02,return_50d:.03,return_120d:.04,return_200d:.05,return_12m:.06,action_guide:'테스트 전용'}))
const etfs=Array.from({length:7},(_,i)=>({...rows[0],id:'etf-'+i,ticker:'ETF'+i,market:'US',name:'검증 ETF '+i,asset_class:'ETF',sector:'Information Technology',rs_rank:null,ibd_rs_estimate:null,leader_tt:false,leadership_class:'중립',rs_1m:i===6?null:i/100,rs_3m:i===6?null:i/100,rs_6m:null,rs_12m:null,high_52w_distance:i===6?null:-.02*i}))
for(const view of [{name:'phone',width:390,height:844,touch:true},{name:'ipad-portrait',width:834,height:1194,touch:true},{name:'ipad-landscape',width:1194,height:834,touch:true},{name:'ipad-pro',width:1366,height:1024,touch:true},{name:'desktop',width:1440,height:900,touch:false}]){
 test(view.name+' layout and stock parity',async({browser})=>{
  const context=await browser.newContext({viewport:{width:view.width,height:view.height},hasTouch:view.touch,isMobile:view.touch});
  const page=await context.newPage();
  await page.route('**/functions/v1/position-public?*',route=>route.fulfill({json:{rows:[]}}));
  await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows:[...rows,...etfs]}}));
  await page.addInitScript(()=>{if(!localStorage.getItem('folio-stock-size'))localStorage.setItem('folio-stock-size','all')});await page.goto('http://127.0.0.1:4173/peppercorn/');await openPage(page,'시장 요약');
  await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000})
  await openSignal(page);
  // Sector and ETF tools remain in the secondary Market Signal workspace.
  await expect(page.locator('.focus-sector-table thead th')).toHaveText(['섹터','RS 순위','주도','등락 20D','등락 50D','52W 근접']);
  await expect(page.locator('.dashboard-sector-panel .dashboard-sector-table tbody tr')).toHaveCount(2);
  if(view.touch){
    await expect(page.locator('.mobile-sector-list .decision-row')).toHaveCount(2);
    await expect(page.locator('.mobile-sector-list')).toBeVisible();
    await expect(page.locator('.dashboard-sector-table-wrap')).toBeHidden();
    await expect(page.locator('.mobile-bottom-nav b')).toHaveText(['오늘','발견','저널','여정']);
    if(view.width<=650){
      await expect(page.locator('.toolbar input')).toBeVisible();
      await expect(page.locator('.topbar p')).toBeHidden();
    }
  }else{
    await expect(page.locator('.mobile-sector-list')).toBeHidden();
    await expect(page.locator('.dashboard-sector-table-wrap')).toBeVisible();
  }
  const etfPanel=page.locator('.dashboard-etf-panel');
  const etfRows=etfPanel.locator('.stock-row');
  await expect(etfRows).toHaveCount(5);
  await expect(etfRows.locator('.stock-id b')).toHaveText(['검증 ETF 5','검증 ETF 4','검증 ETF 3','검증 ETF 2','검증 ETF 1']);
  await expect(etfRows.first().locator('strong').nth(0)).toHaveText('99');
  await expect(etfRows.first().locator('strong').nth(1)).toHaveText('—');
  await expect(etfRows.first().locator('span').last()).toHaveText('-10.0%');
  // Sector and ETF analysis are laid out openly; no disclosure step hides market tools.
  await expect(page.locator('.dashboard-section.market-internals')).toHaveCount(0);
  const sectorActions=page.locator('.dashboard-sector-panel .sector-actions button');
  await expect(sectorActions).toHaveText(['전체 보기 →']);
  const sectorTools=page.locator('.sector-heat-disclosure');
  await expect(sectorTools).toBeVisible();
  await expect(sectorTools.getByRole('heading',{name:'시장 지표 · 섹터 히트맵'})).toBeVisible();
  await sectorTools.getByRole('button',{name:'시장 지표 보기'}).click();
  const metrics=page.locator('.market-metrics-dialog');
  await expect(metrics.getByRole('heading',{name:'시장 지표'})).toBeVisible();
  expect(await metrics.locator('.market-context').evaluate(e=>getComputedStyle(e).whiteSpace)).toBe('normal');
  await expect(metrics.locator('.market-metric-card')).toHaveCount(4);
  await expect(metrics).not.toContainText('평균 RS');
  const mc=await metrics.locator('.market-metric-card').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,r:r.right}}));
  const dialogBox=(await metrics.boundingBox())!;
  for(const c of mc){expect(c.x).toBeGreaterThanOrEqual(dialogBox.x);expect(c.r).toBeLessThanOrEqual(dialogBox.x+dialogBox.width+1)}
  if(view.width<700){expect(mc[0].y).toBe(mc[1].y);expect(mc[2].y).toBe(mc[3].y);expect(mc[2].y).toBeGreaterThan(mc[0].y)}
  else expect(new Set(mc.map(c=>Math.round(c.y))).size).toBeLessThanOrEqual(2);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBeTruthy();
  await page.keyboard.press('Escape');
  await expect(metrics).toHaveCount(0);
  await expect(page.locator('.ui-dialog-overlay')).toHaveCount(0);
  const explore=page.locator('.dashboard-explore-expanded');
  await expect(explore).toBeVisible();
  await expect(etfPanel).toBeVisible();
  const sectorHead=page.locator('.dashboard-sector-panel .sector-name-head'),etfHead=etfPanel.locator('.stock-name-head');
  if(!view.touch){
    const sameWidth=async()=>{const a=(await sectorHead.boundingBox())!.width,b=(await etfHead.boundingBox())!.width;expect(Math.abs(a-b)).toBeLessThan(1.5);return a};
    const before=await sameWidth();
    const sectorResizer=page.locator('.dashboard-sector-panel').getByRole('button',{name:'섹터 열 너비 조절'});
    await sectorResizer.evaluate(e=>e.scrollIntoView({block:'center'}));
    const sectorResize=(await sectorResizer.boundingBox())!;
    await page.mouse.move(sectorResize.x+sectorResize.width/2,sectorResize.y+sectorResize.height/2);
    await page.mouse.down();await page.mouse.move(sectorResize.x+sectorResize.width/2+30,sectorResize.y+sectorResize.height/2);await page.mouse.up();
    expect(await sameWidth()).toBeGreaterThan(before+20);
  }
  const etfScroll=etfPanel.locator('.stock-rows');
  await etfScroll.evaluate(e=>{e.scrollLeft=200});
  expect(Math.abs((await etfHead.boundingBox())!.x-(await etfScroll.boundingBox())!.x)).toBeLessThan(6);
  await etfScroll.evaluate(e=>{e.scrollLeft=0});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBeTruthy();
  // Leading stocks are a popup on every screen: no right-hand panel, a sector row opens the drill sheet.
  await expect(page.locator('.dashboard-stock-panel')).toHaveCount(0);
  if(view.touch)await page.locator('.mobile-sector-list .decision-row').first().click();
  else await page.locator('.dashboard-sector-panel .dashboard-sector-table tbody tr').first().click();
  const drill=page.locator('.drill-sheet');
  await expect(drill).toBeVisible();
  await expect(drill.locator('.drill-tabs button')).toHaveCount(4);
  expect((await etfPanel.locator('.stock-rows-head > span').allTextContents()).slice(1)).toEqual((await drill.locator('.stock-rows-head > span').allTextContents()).slice(1));
  for(const period of ['5D','20D','50D','120D','200D','52W'])await expect(drill.locator('.stock-rows-head').getByText('등락 '+period,{exact:true})).toBeVisible();
  const scroll=drill.locator('.stock-rows');
  await scroll.evaluate(e=>{e.scrollLeft=200});
  expect(Math.abs((await drill.locator('.stock-name-head').boundingBox())!.x-(await scroll.boundingBox())!.x)).toBeLessThan(6);
  await scroll.evaluate(e=>{e.scrollLeft=0});
  await drill.locator('.stock-row').first().focus();await page.keyboard.press('Enter');
  const rsSection=page.locator('.drill-sheet .snapshot-section').filter({has:page.getByRole('heading',{name:'상대강도'})});
  await expect(rsSection.locator('.signal-strip strong')).toHaveText(['+1.0%','+2.0%','+3.0%','+4.0%','+5.0%','+6.0%']);
  await expect(page.getByRole('button',{name:'종목분석 기록 작성 →'})).toBeVisible();
  await page.getByRole('button',{name:'닫기',exact:true}).click();
  await expect(page.locator('.drill-sheet')).toHaveCount(0);
  await etfPanel.getByRole('button',{name:'전체 보기 →'}).click();
  const etfDialog=page.locator('.etf-summary-dialog');
  await expect(etfDialog.locator('.stock-row')).toHaveCount(7);
  await expect(etfDialog.locator('.stock-row').last().locator('strong').nth(0)).toHaveText('—');
  await expect(etfDialog.locator('.stock-row').last().locator('span').last()).toHaveText('—');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBeTruthy();
  await etfDialog.locator('.stock-row').first().click();
  await expect(etfDialog).toHaveCount(0);
  await expect(page.locator('.drill-sheet .leadership-score').first()).toContainText('ETF RS순위');
  await expect(page.locator('.drill-sheet .leadership-score').first()).toContainText('99');
  await page.getByRole('button',{name:'닫기',exact:true}).click();
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:`test-results/${view.name}.png`,fullPage:true});
  await context.close();
 })
}

test('Home ETF preview and 시장 신호 summary use the exact same ranked pool',async({page})=>{
  await page.route('**/functions/v1/position-public?*',route=>route.fulfill({json:{rows:[]}}));
  await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows:[...rows,...etfs]}}));
  await page.addInitScript(()=>{
    sessionStorage.setItem('peppercorn-intro-seen','1');
    localStorage.setItem('folio-theme','light');
    localStorage.setItem('folio-stock-size','etf');
  });
  await page.goto('http://127.0.0.1:4173/peppercorn/');await openPage(page,'시장 요약');
  await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000});
  const homeNames=await page.locator('.journey-today .stock-trend-copy>.stock-trend-name').allTextContents();
  expect(homeNames).toEqual(['검증 ETF 5','검증 ETF 4','검증 ETF 3','검증 ETF 2','검증 ETF 1']);
  await page.locator('.journey-market').getByRole('button',{name:'전체 보기 →',exact:true}).click();
  await expect(page.locator('.signal-journey-heading h2')).toHaveText('시장 신호');
  const signalNames=await page.locator('.dashboard-etf-panel .stock-id b').allTextContents();
  expect(signalNames).toEqual(homeNames);
});

test('Home ETF Top 5 matches 시장 신호 ETF Top 5 exactly',async({page})=>{
  await page.route('**/functions/v1/position-public?*',route=>route.fulfill({json:{rows:[]}}))
  await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows:[...rows,...etfs]}}))
  await page.route('**/functions/v1/quotes?*',route=>route.fulfill({json:{quotes:{}}}))
  await page.route('**/functions/v1/price-history?*',route=>route.fulfill({json:{series:{}}}))
  await page.addInitScript(()=>{sessionStorage.setItem('peppercorn-intro-seen','1');localStorage.setItem('folio-stock-size','all')})
  await page.goto('http://127.0.0.1:4173/peppercorn/');await openPage(page,'시장 요약')
  await expect(page.locator('.journey-home')).toBeVisible()
  await page.getByRole('group',{name:'분류'}).getByRole('button',{name:'ETF',exact:true}).click()
  const homeNames=await page.locator('.journey-today .stock-trend-copy>.stock-trend-name').allTextContents()
  expect(homeNames).toHaveLength(5)
  await openSignal(page)
  const signalNames=await page.locator('.dashboard-etf-panel .stock-row .stock-id b').allTextContents()
  expect(signalNames.slice(0,5)).toEqual(homeNames)
})

test('RS bands refresh in an already open stock detail',async({page})=>{
  let calls=0;
  await page.route('**/functions/v1/position-public?*',route=>route.fulfill({json:{rows:[]}}));
  await page.route('**/functions/v1/leaderboard?*',route=>{
    calls++;
    route.fulfill({json:{rows:rows.map(r=>({...r,rs_5d:calls===1?null:'0.11'}))}});
  });
  await page.addInitScript(()=>{if(!localStorage.getItem('folio-stock-size'))localStorage.setItem('folio-stock-size','all')});await page.goto('http://127.0.0.1:4173/peppercorn/');await openPage(page,'시장 요약');
  await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000})
  await openSignal(page);
  await page.locator('.dashboard-sector-panel .dashboard-sector-table tbody tr').first().click();
  await page.locator('.drill-sheet .stock-row').first().click();
  const rs=page.locator('.drill-sheet .snapshot-section').filter({has:page.getByRole('heading',{name:'상대강도'})});
  await expect(rs.locator('.signal-strip strong').first()).toHaveText('—');
  await page.getByRole('button',{name:'RS 새로고침'}).click();
  await expect(rs.locator('.signal-strip strong').first()).toHaveText('+11.0%');
  await expect(page.locator('.drill-sheet .drill-meta')).toContainText('TEST0');
  expect(calls).toBe(2);
});

test('ETF detail shows ETF-only ranks, Trend Template, verdict and action guide',async({page})=>{
  const etf={...rows[0],id:'etf-spy',ticker:'SPY',name:'SPY ETF',asset_class:'ETF',rs_rank:null,ibd_rs_estimate:null,ibd_rs_as_of:null,leader_tt:false,leadership_class:'중립'};
  await page.route('**/functions/v1/position-public?*',route=>route.fulfill({json:{rows:[]}}));
  const qqq={...etf,id:'etf-qqq',ticker:'QQQ',name:'QQQ ETF',rs_1m:.2,rs_3m:.2,ibd_rs_estimate:92,ibd_rs_as_of:'2026-09-28',leader_tt:true,leadership_class:'주도 후보',stage:'▲ 돌파 매수권',verdict:'★ 우선 분석',action_guide:'52주 고점(피벗) 돌파와 거래량 ≥1.4배를 함께 확인'};
  await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows:[qqq,etf]}}));
  await page.addInitScript(()=>{if(!localStorage.getItem('folio-stock-size'))localStorage.setItem('folio-stock-size','all')});await page.goto('http://127.0.0.1:4173/peppercorn/');await openPage(page,'시장 요약');
  await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000})
  await openSignal(page);
  // ETF summary is always visible on the Sector › ETF page.
  const top=page.locator('.dashboard-etf-panel .stock-row').first();
  await expect(top.locator('.stock-id b')).toHaveText('QQQ ETF');
  await expect(top.locator('strong').nth(0)).toHaveText('99');
  await expect(top.locator('strong').nth(1)).toHaveText('92');
  await expect(top.locator('strong').nth(1)).toHaveAttribute('title','가격 기준 2026-09-28 · 같은 시장 ETF끼리 비교한 추정치(ETF-IBD-1)');
  await top.click();
  await expect(page.locator('.drill-sheet .drill-guide')).toContainText('52주 고점(피벗) 돌파');
  await expect(page.locator('.drill-sheet .drill-checks b').first()).toHaveText('PASS');
  await expect(page.locator('.drill-sheet .leadership-copy')).toContainText('★ 우선 분석');
  await expect(page.locator('.drill-sheet .leadership-section .snapshot-section-head .pill')).toHaveText('해당 없음');
  await page.getByRole('button',{name:'닫기',exact:true}).click();
  // Analysis checklist: SPY has no IBD history, fails the Trend Template, ranks below QQQ among ETFs.
  await page.locator('.sidebar nav').getByRole('button',{name:'발견',exact:true}).click();
  // ETF is a first-class Explore classification and ignores equity leadership tabs.
  await page.getByRole('group',{name:'분류'}).getByRole('button',{name:'ETF',exact:true}).click();
  await page.locator('.stock-list button').filter({hasText:'SPY'}).click();
  await expect(page.locator('.analysis-card .hero-name')).toContainText('SPY ETF');
  await page.locator('.analysis-card .analysis-detail-tabs').getByRole('tab',{name:'Analysis'}).click();
  const rs=page.locator('.analysis-card .snapshot-section').filter({has:page.getByRole('heading',{name:'상대강도'})});
  await expect(rs.locator('.signal-strip strong')).toHaveText(['+1.0%','+2.0%','+3.0%','+4.0%','+5.0%','+6.0%']);
  await expect(page.locator('.analysis-card .leadership-score').first()).toContainText('ETF RS순위50');
  await expect(page.locator('.analysis-card .ibd-score')).toHaveAttribute('title','ETF 가격 이력 253거래일 미만');
  await expect(page.locator('.analysis-card .checklist label').filter({hasText:'Trend Template'}).locator('b')).toHaveText('CHECK');
  await expect(page.locator('.analysis-card .checklist label').filter({hasText:'RS순위 ≥ 70'}).locator('b')).toHaveText('CHECK');
});

test('ETF 주도 산업 treemap sizes by trading value, colours by the chosen RS period and sits under 섹터 요약',async({browser})=>{
  test.setTimeout(120_000);
  const base={...rows[0],asset_class:'ETF',rs_rank:null,ibd_rs_estimate:null,leader_tt:false,leadership_class:'중립'};
  const mk=(id:string,market:string,industry:string,sector:string,value:number|null,rs20:number,rs5:number)=>
    ({...base,id,ticker:id,name:id+' ETF',market,industry,sector,traded_value_20d:value,rs_20d:rs20,rs_5d:rs5,rs_1m:rs20,rs_3m:rs20});
  const data=[...rows,
    mk('SMH','US','Semiconductors','Information Technology',6e8,.08,.01),mk('SOXX','US','Semiconductors','Information Technology',2e8,.04,.01),
    mk('ITA','US','Aerospace & Defense','Industrials',2e8,.03,-.02),mk('XBI','US','Biotechnology','Health Care',1e8,-.07,.04),
    mk('SPY','US','S&P 500','Broad Market',9e10,0,0),mk('NOVAL','US','Software','Information Technology',null,.02,.02),
    mk('KSEMI','KR','Semiconductors','Information Technology',3e11,.10,.00),mk('KSHIP','KR','Shipbuilding','Industrials',1e11,-.03,-.05)];
  const rgb=(hex:string)=>`rgb(${parseInt(hex.slice(1,3),16)}, ${parseInt(hex.slice(3,5),16)}, ${parseInt(hex.slice(5,7),16)})`;
  for(const view of [{width:390,height:844,touch:true},{width:834,height:1194,touch:true},{width:1194,height:834,touch:true},{width:1366,height:1024,touch:true},{width:1440,height:900,touch:false}]){
    const context=await browser.newContext({viewport:{width:view.width,height:view.height},hasTouch:view.touch,isMobile:view.touch});
    const page=await context.newPage();
    await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows:data}}));
    await page.addInitScript(()=>{if(!localStorage.getItem('folio-stock-size'))localStorage.setItem('folio-stock-size','all')});await page.goto('http://127.0.0.1:4173/peppercorn/');await openPage(page,'시장 요약');
    await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000})
  await openSignal(page);
    const panel=page.locator('.dashboard-etf-industry-panel');
    // ETF exploration is fully expanded directly below the sector map.
    const explore=page.locator('.dashboard-explore-expanded');
    await expect(explore).toBeVisible();
    await expect(panel).toBeVisible();
    const heatBox=(await panel.boundingBox())!,etfBox=(await page.locator('.dashboard-etf-panel').boundingBox())!;
    if(view.width>=1100){
      expect(Math.abs(etfBox.y-heatBox.y)).toBeLessThan(4);
      expect(etfBox.x).toBeGreaterThan(heatBox.x+heatBox.width-1);
    }else{
      expect(etfBox.y).toBeGreaterThan(heatBox.y+heatBox.height-1);
    }
    // One map per market; broad-market and valueless industries have no tile; KR labels are Korean.
    await expect(panel.locator('.etf-heat-market-head b')).toHaveText(['KR','US']);
    const us=panel.locator('.etf-heat-market').nth(1),kr=panel.locator('.etf-heat-market').nth(0);
    await expect(us.locator('.etf-heat-tile')).toHaveCount(3);
    await expect(kr.locator('.etf-heat-tile b')).toHaveText(['반도체','조선']);
    await expect(panel.locator('.etf-heat-legend').first()).toContainText('거래대금 없는 산업 1개 제외');
    // Area ∝ trading value within each market (US: 8e8 / 2e8 / 1e8 of 1.1e9).
    const map=(await us.locator('.etf-heat-map').boundingBox())!;
    const areas=await us.locator('.etf-heat-tile').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {t:e.getAttribute('title')!.split(' · ')[0],a:(r.width+2)*(r.height+2)}}));
    const share=Object.fromEntries(areas.map(x=>[x.t,x.a/(map.width*map.height)]));
    expect(Math.abs(share['Semiconductors']-8/11)).toBeLessThan(.02);
    expect(Math.abs(share['Biotechnology']-1/11)).toBeLessThan(.02);
    // 20D colours: US Semis median +6% ≥ 6% → strong red; Biotech −7% → strong blue; A&D +3% → light red.
    const tile=(scope:any,name:string)=>scope.locator('.etf-heat-tile').filter({has:page.locator('b',{hasText:name})});
    await expect(tile(us,'Semiconductors')).toHaveCSS('background-color',rgb('#196b42'));
    await expect(tile(us,'Biotechnology')).toHaveCSS('background-color',rgb('#b3261e'));
    await expect(tile(us,'Aerospace & Defense')).toHaveCSS('background-color',rgb('#63b38b'));
    await expect(tile(us,'Semiconductors').locator('strong')).toHaveText('+6%');
    // Switching the period recolours: 5D Biotech +4% ≥ 3% → strong red.
    await panel.getByRole('button',{name:'5D',exact:true}).click();
    await expect(tile(us,'Biotechnology')).toHaveCSS('background-color',rgb('#196b42'));
    await expect(tile(us,'Biotechnology').locator('strong')).toHaveText('+4%');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBeTruthy();
    await tile(kr,'반도체').click();
    const dialog=page.locator('.etf-summary-dialog');
    await expect(dialog.getByRole('heading')).toHaveText('ETF 주도 산업 · 반도체');
    await expect(dialog.locator('.stock-row .stock-id b')).toHaveText(['KSEMI ETF']);
    await page.getByRole('button',{name:'닫기',exact:true}).click();
    await page.locator('.toolbar .segment').getByRole('button',{name:'US'}).click();
    await expect(panel.locator('.etf-heat-market-head b')).toHaveText(['US']);
    await context.close();
  }
});

test('failed live load can be retried from the demo state',async({page})=>{
  let calls=0;
  await page.route('**/functions/v1/position-public?*',route=>route.fulfill({json:{rows:[]}}));
  await page.route('**/functions/v1/leaderboard?*',route=>{
    calls++;
    // The initial load and its one automatic retry fail; the manual retry succeeds.
    calls<=2?route.fulfill({status:503,body:'unavailable'}):route.fulfill({json:{rows}});
  });
  await page.addInitScript(()=>{if(!localStorage.getItem('folio-stock-size'))localStorage.setItem('folio-stock-size','all')});await page.goto('http://127.0.0.1:4173/peppercorn/');await openPage(page,'시장 요약');
  await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000})
  await openSignal(page);
  await expect.poll(()=>calls,{timeout:10000}).toBe(2);
  await expect(page.getByRole('button',{name:'시장 데이터 새로고침'})).toContainText('Demo / Local');
  await page.getByRole('button',{name:'시장 데이터 새로고침'}).click();
  await expect(page.getByRole('button',{name:'시장 데이터 새로고침'})).toContainText('Supabase Live');
  expect(calls).toBe(3);
});

test('a stalled live response releases the refresh controls',async({page})=>{
  let calls=0;
  await page.route('**/functions/v1/position-public?*',route=>route.fulfill({json:{rows:[]}}));
  await page.route('**/functions/v1/leaderboard?*',route=>{
    calls++;
    if(calls>1)void route.fulfill({json:{rows}});
  });
  await page.addInitScript(()=>{if(!localStorage.getItem('folio-stock-size'))localStorage.setItem('folio-stock-size','all')});await page.goto('http://127.0.0.1:4173/peppercorn/');await openPage(page,'시장 요약');
  test.setTimeout(60_000);
  const refresh=page.getByRole('button',{name:'시장 데이터 새로고침'});
  // The first request stalls and aborts after 25 s; the automatic retry 4 s later succeeds.
  await expect(refresh).toContainText('Supabase Live',{timeout:40_000});
  await expect(refresh).toBeEnabled();
  expect(calls).toBe(2);
});

test('KR ETFs show their Korean name in the dashboard ETF summary and detail',async({page})=>{
  const kr={...rows[1],id:'etf-kr',ticker:'069500',market:'KR',name:'Samsung KODEX 200 Securities ETF',asset_class:'ETF',rs_rank:null,ibd_rs_estimate:null,leader_tt:false,leadership_class:'중립'};
  await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows:[...rows,kr]}}));
  await page.addInitScript(()=>{if(!localStorage.getItem('folio-stock-size'))localStorage.setItem('folio-stock-size','all')});await page.goto('http://127.0.0.1:4173/peppercorn/');await openPage(page,'시장 요약');
  await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000})
  await openSignal(page);
  const row=page.locator('.dashboard-etf-panel .stock-row').first();
  await expect(row.locator('.stock-id b')).toHaveText('KODEX 200');
  await row.click();
  await expect(page.locator('.drill-sheet h2').first()).toHaveText('KODEX 200');
});

test('table headers are left-aligned and numeric cells right-aligned',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.route('**/functions/v1/leaderboard?*',route=>route.fulfill({json:{rows:[...rows,...etfs]}}));
  await page.addInitScript(()=>{if(!localStorage.getItem('folio-stock-size'))localStorage.setItem('folio-stock-size','all')});await page.goto('http://127.0.0.1:4173/peppercorn/');await openPage(page,'시장 요약');
  await expect(page.locator('.launch-overlay')).toHaveCount(0,{timeout:15000})
  await openSignal(page);
  const align=(loc:any)=>loc.evaluateAll((es:Element[])=>[...new Set(es.map(e=>getComputedStyle(e).textAlign))]);
  const sector=page.locator('.dashboard-sector-panel .sector-metrics-table');
  expect(await align(sector.locator('th'))).toEqual(['left']);
  expect(await align(sector.locator('tbody tr').first().locator('td:not(:first-child)'))).toEqual(['right']);
  expect(await align(sector.locator('tbody tr').first().locator('td:first-child'))).toEqual(['left']);
  await page.locator('.dashboard-sector-panel .dashboard-sector-table tbody tr').first().click();
  for(const panel of ['.drill-sheet','.dashboard-etf-panel']){
    if(panel==='.dashboard-etf-panel'){
      await page.keyboard.press('Escape');await expect(page.locator('.drill-sheet')).toHaveCount(0);
    }
    const rows=page.locator(panel+' .stock-rows');
    expect(await align(rows.locator('.stock-rows-head > span'))).toEqual(['left']);
    const first=rows.locator('.stock-row').first();
    expect(await align(first.locator(':scope > span:not(.pill), :scope > strong'))).toEqual(['right']);
    expect(await align(first.locator('.stock-id'))).toEqual(['left']);
    const rank=first.locator('strong.rank').first();
    expect(await rank.evaluate(e=>getComputedStyle(e).justifyContent)).toBe('flex-end');
    const pill=(await first.locator('.pill').boundingBox())!,change=(await first.locator('.live-change').boundingBox())!;
    expect(pill.x-(change.x+change.width)).toBeLessThan(12);
    await expect(first.locator('.live-change')).toHaveText('—');
  }
  await page.locator('.sidebar nav').getByRole('button',{name:'Leaderboard'}).click();
  const priceCell=page.locator('.ag-row .ag-cell[col-id="price"]').first();
  await expect(priceCell).toHaveClass(/cell-num/);
  expect(await priceCell.evaluate(e=>getComputedStyle(e).textAlign)).toBe('right');
  await expect(page.locator('.ag-row .ag-cell[col-id="ibd_rs_estimate"]').first()).toHaveClass(/cell-num/);
  await expect(page.locator('.ag-row .ag-cell[col-id="ticker"]').first()).not.toHaveClass(/cell-num/);
  await expect(page.locator('.ag-row .ag-cell[col-id="industry"]').first()).not.toHaveClass(/cell-num/);
  expect(await page.locator('.ag-header-cell[col-id="price"] .ag-header-cell-label').evaluate(e=>getComputedStyle(e).justifyContent)).toBe('flex-start');
});
