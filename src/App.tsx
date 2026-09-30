import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import gsap from 'gsap'
import type { ColDef } from 'ag-grid-community'
import { Sidebar } from './components/Sidebar'
import { InstallApp } from './components/InstallApp'
import { GridTable } from './components/GridTable'
import { AuthModal } from './components/AuthModal'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from './components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from './components/ui/alert-dialog'
import { initialAnalysis, initialJournal, initialPortfolio, initialResearch, initialWatchlist } from './data/mock'
import { loadLeaderboard } from './lib/rest'
import { ETF_RS_RANK_VERSION, withEtfRanks } from './lib/etfRank'
import { applyKrEtfNames } from './lib/krEtfNames'
import { ETF_HEAT_PERIODS, ETF_INDUSTRY_VERSION, buildEtfIndustries, etfIndustryLabel, type EtfHeatPeriod, type EtfIndustry } from './lib/etfIndustries'
import { squarify } from './lib/treemap'
import { loadStoredSession, loadWorkspace, saveWorkspace, storeSession, type Session, type WorkspaceResource } from './lib/session'
import { LiveQuoteProvider, useLiveQuotes, type LiveQuote } from './lib/liveQuotes'
import type { EditableRow, LeaderRow, Market } from './types'

const pct=(v:unknown)=>{const n=Number(v);return v==null||!Number.isFinite(n)?'—':(n>=0?'+':'')+(n*100).toFixed(1)+'%'}
const num=(v:unknown)=>{const n=Number(v);return v==null||!Number.isFinite(n)?'—':n.toLocaleString('ko-KR')}
const gapPct=(price:number|null|undefined,base:number|null|undefined)=>price==null||base==null||Number(base)===0?'—':pct(Number(price)/Number(base)-1)
const krSectorNames:Record<string,string>={
  'Producer Manufacturing':'생산재 제조','Electronic Technology':'전자·반도체',
  'Process Industries':'소재·화학','Health Technology':'헬스케어 기술',
  'Consumer Non-Durables':'비내구 소비재','Finance':'금융',
  'Technology Services':'IT 서비스','Consumer Durables':'내구 소비재',
  'Consumer Services':'소비자 서비스','Non-Energy Minerals':'비에너지 광물',
  'Retail Trade':'소매업','Industrial Services':'산업 서비스',
  'Transportation':'운송','Commercial Services':'기업 서비스',
  'Distribution Services':'유통 서비스','Energy Minerals':'에너지 광물',
  'Communications':'통신','Utilities':'유틸리티','Health Services':'의료 서비스'
}
const sectorName=(market:Market,sector:string)=>market==='KR'?(krSectorNames[sector]||sector):sector
const sourceName=(source:string)=>source.includes('TradingView')?(source.includes('KRX')?'TradingView·KRX':'TradingView'):source.includes('Nasdaq')?'Nasdaq':source.includes('S&P 500')?'S&P 500':source.replace(/^AUTO:/,'').slice(0,28)
const CANDIDATE_RS_MIN=80
const CANDIDATE_HIGH_DISTANCE_MIN=-.25
const SHEET_URL='https://docs.google.com/spreadsheets/d/1KdbQqmGP7Q0iVV76OmJg1wpP9pB5vrni5SrjAMrbbiE/edit'
const tradingViewUrl=(r:LeaderRow)=>'https://www.tradingview.com/chart/?symbol='+encodeURIComponent(r.market==='KR'?'KRX:'+r.ticker:r.ticker)
const saveTickerUrl=(r:LeaderRow)=>'https://www.saveticker.com/company/'+encodeURIComponent(r.ticker)+'?entry=search_result'
const med=(values:unknown[])=>{
  const a=values.filter(v=>v!=null&&v!=='').map(Number).filter(Number.isFinite).sort((x,y)=>x-y)
  if(!a.length) return null
  const m=Math.floor(a.length/2)
  return a.length%2?a[m]:(a[m-1]+a[m])/2
}
const avg=(values:unknown[])=>{
  const a=values.filter(v=>v!=null&&v!=='').map(Number).filter(Number.isFinite)
  return a.length?a.reduce((sum,value)=>sum+value,0)/a.length:null
}
const leadership=(r:LeaderRow)=>{
  // The leadership class (핵심 주도·주도 후보·강세 전환) is equity-only; ETFs get Trend Template/stage/verdict (ETF-SWING-1) but no class.
  if(r.asset_class&&r.asset_class!=='Equity')return '해당 없음'
  if(r.leadership_class)return r.leadership_class
  if(r.leader_tt&&(r.rs_rank??0)>=95&&(r.high_52w_distance??-1)>=-.15&&(r.rs_3m??-1)>0&&(r.rs_6m??-1)>0)return '핵심 주도'
  if(r.leader_tt&&(r.ibd_rs_estimate??0)>=CANDIDATE_RS_MIN&&(r.high_52w_distance??-1)>=CANDIDATE_HIGH_DISTANCE_MIN&&(r.rs_3m??-1)>0)return '주도 후보'
  if(String(r.stage).includes('넥스트 리더'))return '강세 전환'
  if(String(r.stage).startsWith('❌'))return '약세'
  return '중립'
}
const isCorrection=(r:LeaderRow)=>String(r.stage||'').includes('조정 중')
const stageLabel=(value:unknown)=>String(value||'').replace('조정 중 주도주','조정 중')
const stageTone=(value:unknown)=>{const s=String(value||'');return s.startsWith('▲')?'green':s.startsWith('●')?'green-soft':s.startsWith('◆')?'blue':s.startsWith('■')?'violet':s.startsWith('◇')?'teal':s.startsWith('↻')?'amber':s.startsWith('⛔')?'red':s.startsWith('❌')?'gray':'gray'}
const leadTone=(s:string)=>['핵심 주도','강한 섹터'].includes(s)?'green':s==='주도 후보'?'blue':['강세 전환','개선 섹터'].includes(s)?'amber':s==='약세'?'red':'gray'
const selectEditor=(values:(string|number|boolean)[])=>({cellEditor:'agSelectCellEditor',cellEditorParams:{values}})
const rowNo={headerName:'No',width:62,flex:0,editable:false,valueGetter:(p:any)=>(p.node?.rowIndex??0)+1}

function useLocalRows<T>(key:string,initial:T[]){
  const [rows,setRows]=useState<T[]>(()=>{
    try{const saved=localStorage.getItem(key);return saved?JSON.parse(saved) as T[]:initial}catch{return initial}
  })
  const update=(next:T[])=>{setRows(next);localStorage.setItem(key,JSON.stringify(next))}
  return [rows,update] as const
}

type SectorSummary={
  key:string;market:Market;sector:string;n:number;core:number;candidate:number;turn:number;correction:number;
  coreShare:number;breadth:number;medRank:number|null;
  medRs1w:number|null;medRs1m:number|null;medRs3m:number|null;
  medRet1w:number|null;medRet1m:number|null;medRet3m:number|null;
  medRet5d:number|null;medRet20d:number|null;medRet50d:number|null;
  medRet120d:number|null;medRet200d:number|null;medRet12m:number|null;
  avgRet1w:number|null;highNearShare:number;
  verdict:string;smallSample:boolean;top:string[]
}

const sectorKey=(r:LeaderRow)=>`${r.market}|${r.sector||'분류 확인'}`
function buildSectors(rows:LeaderRow[]):SectorSummary[]{
  const groups=new Map<string,LeaderRow[]>()
  for(const r of rows){
    if(r.asset_class!=='Equity'||!r.sector||r.sector==='분류 확인')continue
    const key=sectorKey(r)
    const list=groups.get(key)||[];list.push(r);groups.set(key,list)
  }
  return [...groups.entries()].map(([key,list])=>{
    const n=list.length
    const core=list.filter(r=>leadership(r)==='핵심 주도').length
    const candidate=list.filter(r=>leadership(r)==='주도 후보').length
    const turn=list.filter(r=>leadership(r)==='강세 전환').length
    const correction=list.filter(isCorrection).length
    const coreShare=n?core/n:0
    const breadth=n?list.filter(r=>r.price!=null&&r.ma50!=null&&Number(r.price)>Number(r.ma50)).length/n:0
    const medRank=med(list.map(r=>r.rs_rank))
    const medRs1w=med(list.map(r=>r.rs_1w)),medRs1m=med(list.map(r=>r.rs_1m)),medRs3m=med(list.map(r=>r.rs_3m))
    const medRet1w=med(list.map(r=>r.return_1w)),medRet1m=med(list.map(r=>r.return_1m)),medRet3m=med(list.map(r=>r.return_3m))
    const medRet5d=med(list.map(r=>r.return_5d)),medRet20d=med(list.map(r=>r.return_20d)),medRet50d=med(list.map(r=>r.return_50d))
    const medRet120d=med(list.map(r=>r.return_120d)),medRet200d=med(list.map(r=>r.return_200d)),medRet12m=med(list.map(r=>r.return_12m))
    const avgRet1w=avg(list.map(r=>r.return_1w))
    const highNearRows=list.filter(r=>r.high_52w_distance!=null)
    const highNearShare=highNearRows.length?highNearRows.filter(r=>Number(r.high_52w_distance)>=-.10).length/highNearRows.length:0
    const smallSample=n<3
    const strongShare=n?(core+candidate)/n:0
    const improvingShare=n?(candidate+turn+correction)/n:0
    let verdict='중립'
    if(smallSample){
      if(core>0&&(medRank??0)>=90&&(medRs3m??-1)>0)verdict='강한 섹터'
      else if((candidate+turn)>0&&(medRank??0)>=70&&(medRs1m??-1)>0)verdict='개선 섹터'
      else if(breadth<.35&&(medRank??50)<40)verdict='약세'
    }else if(strongShare>=.25&&(medRank??0)>=75&&breadth>=.55&&(medRs3m??-1)>0)verdict='강한 섹터'
    else if(improvingShare>=.35&&(medRank??0)>=55&&breadth>=.45&&(medRs1m??-1)>0)verdict='개선 섹터'
    else if(breadth<.35&&(medRank??50)<45)verdict='약세'
    const ranked=list.slice().sort((a,b)=>(b.rs_rank??0)-(a.rs_rank??0)).slice(0,3).map(r=>r.name)
    return {key,market:list[0].market,sector:list[0].sector||'분류 확인',n,core,candidate,turn,correction,coreShare,breadth,medRank,medRs1w,medRs1m,medRs3m,medRet1w,medRet1m,medRet3m,medRet5d,medRet20d,medRet50d,medRet120d,medRet200d,medRet12m,avgRet1w,highNearShare,verdict,smallSample,top:ranked}
  }).sort((a,b)=>(b.medRank??-1)-(a.medRank??-1)||b.coreShare-a.coreShare)
}

const upDownRules={
  'cell-up':(p:any)=>typeof p.value==='number'&&p.value>0,
  'cell-down':(p:any)=>typeof p.value==='number'&&p.value<0
}
const stageRules={
  'stage-breakout':(p:any)=>String(p.value||'').startsWith('▲'),
  'stage-pullback':(p:any)=>String(p.value||'').startsWith('●'),
  'stage-extended':(p:any)=>String(p.value||'').startsWith('◆'),
  'stage-base':(p:any)=>String(p.value||'').startsWith('■'),
  'stage-correction':(p:any)=>String(p.value||'').startsWith('◇'),
  'stage-next':(p:any)=>String(p.value||'').startsWith('↻'),
  'stage-risk':(p:any)=>String(p.value||'').startsWith('⛔'),
  'stage-exclude':(p:any)=>String(p.value||'').startsWith('❌')
}

const leaderCols:ColDef<LeaderRow>[]=[
  {field:'market',headerName:'시장',width:76,flex:0},
  {field:'ticker',headerName:'Ticker',width:96,flex:0,pinned:'left'},
  {field:'name',headerName:'종목명',minWidth:155,pinned:'left'},
  {field:'industry',headerName:'산업',minWidth:165},
  {field:'sector',headerName:'섹터',minWidth:145},
  {headerName:'리더십',minWidth:115,valueGetter:p=>p.data?leadership(p.data):'',cellClassRules:{'lead-one':p=>p.value==='핵심 주도','lead-candidate':p=>p.value==='주도 후보','lead-two':p=>p.value==='강세 전환'}},
  {field:'stage',headerName:'모멘텀 단계',minWidth:150,valueFormatter:p=>stageLabel(p.value),cellClassRules:stageRules},
  {field:'verdict',headerName:'최종 판단',minWidth:135},
  {field:'price',headerName:'현재가',valueFormatter:p=>num(p.value)},
  {field:'ibd_rs_estimate',headerName:'IBD식 RS',width:128,flex:0,headerTooltip:'IBD 공식 점수가 아닌 KR/US 시장별 253거래일 가격 기반 추정치',valueFormatter:p=>p.value??'—'},
  {field:'rs_rank',headerName:'RS순위',cellClassRules:{'rank-high':p=>Number(p.value)>=70,'rank-top':p=>Number(p.value)>=90}},
  {field:'rs_5d',headerName:'RS 5D',valueFormatter:p=>pct(p.value),cellClassRules:upDownRules},
  {field:'rs_20d',headerName:'RS 20D',valueFormatter:p=>pct(p.value),cellClassRules:upDownRules},
  {field:'rs_50d',headerName:'RS 50D',valueFormatter:p=>pct(p.value),cellClassRules:upDownRules},
  {field:'rs_120d',headerName:'RS 120D',valueFormatter:p=>pct(p.value),cellClassRules:upDownRules},
  {field:'rs_200d',headerName:'RS 200D',valueFormatter:p=>pct(p.value),cellClassRules:upDownRules},
  {field:'rs_12m',headerName:'RS 52W',valueFormatter:p=>pct(p.value),cellClassRules:upDownRules},
  {field:'return_5d',headerName:'등락 5D',valueFormatter:p=>pct(p.value),cellClassRules:upDownRules},
  {field:'return_20d',headerName:'등락 20D',valueFormatter:p=>pct(p.value),cellClassRules:upDownRules},
  {field:'return_50d',headerName:'등락 50D',valueFormatter:p=>pct(p.value),cellClassRules:upDownRules},
  {field:'return_120d',headerName:'등락 120D',valueFormatter:p=>pct(p.value),cellClassRules:upDownRules},
  {field:'return_200d',headerName:'등락 200D',valueFormatter:p=>pct(p.value),cellClassRules:upDownRules},
  {field:'return_12m',headerName:'등락 52W',valueFormatter:p=>pct(p.value),cellClassRules:upDownRules},
  {field:'high_52w_distance',headerName:'52W 고점 대비',headerTooltip:'최근 252개 거래 세션의 최고가 대비 현재가',valueFormatter:p=>pct(p.value),cellClassRules:upDownRules},
  {field:'volume_ratio',headerName:'거래량 배수',valueFormatter:p=>p.value==null?'—':Number(p.value).toFixed(2)+'x'},
  {field:'rsi14',headerName:'RSI',valueFormatter:p=>p.value==null?'—':Number(p.value).toFixed(0)},
  {field:'atr_multiple',headerName:'ATR배수',valueFormatter:p=>p.value==null?'—':Number(p.value).toFixed(1)+'x'},
  {field:'action_guide',headerName:'액션 가이드',minWidth:280}
]

const watchCols:ColDef<EditableRow>[]=[
  {field:'market',headerName:'시장',editable:false,width:78,flex:0},{field:'ticker',headerName:'Ticker',editable:false,pinned:'left',width:95,flex:0},
  {field:'name',headerName:'종목명',editable:false,minWidth:140},{field:'industry',headerName:'산업',editable:false,minWidth:150},{field:'sector',headerName:'섹터',editable:false,minWidth:130},
  {field:'stage',headerName:'단계',editable:false,minWidth:145,valueFormatter:p=>stageLabel(p.value),cellClassRules:stageRules},{field:'rs_rank',headerName:'RS순위',editable:false},
  {field:'current_price',headerName:'현재가(자동)',editable:false,valueFormatter:p=>num(p.value)},
  {field:'interest_price',headerName:'관심가'},{field:'stop_pct',headerName:'손절 %'},{field:'priority',headerName:'우선순위'},{field:'note',headerName:'메모',minWidth:260}
]
const portfolioCols:ColDef<EditableRow>[]=[
  {field:'market',headerName:'시장',width:78,flex:0},{field:'ticker',headerName:'Ticker',pinned:'left',width:95,flex:0},
  {field:'name',headerName:'종목명',minWidth:140},{field:'industry',headerName:'산업',editable:false,minWidth:150},{field:'sector',headerName:'섹터',editable:false,minWidth:130},
  {field:'account',headerName:'계좌'},{field:'shares',headerName:'수량'},{field:'avg_price',headerName:'평단'},{field:'current_price',headerName:'현재가(자동)',editable:false,valueFormatter:p=>num(p.value)},
  {field:'stop_price',headerName:'Stop'},{field:'thesis',headerName:'투자 가설',minWidth:300}
]
const researchCols:ColDef<EditableRow>[]=[
  rowNo,
  {field:'date',headerName:'작성일',width:112,flex:0},{field:'type',headerName:'구분',width:95,flex:0,...selectEditor(['매크로','산업','섹터','종목'])},{field:'target',headerName:'대상',minWidth:150},
  {field:'title',headerName:'제목',minWidth:210},{field:'fact',headerName:'핵심 사실 (숫자·팩트)',minWidth:300},{field:'interpretation',headerName:'내 해석',minWidth:300},
  {field:'source',headerName:'출처',minWidth:170},{field:'source_type',headerName:'출처 유형',minWidth:120,...selectEditor(['공시','정부·통계','기업발표','증권사리포트','뉴스','기타'])},
  {field:'verification',headerName:'검증',width:95,flex:0,...selectEditor(['확인됨','미검증','반박됨'])},
  {field:'market_impact',headerName:'시장 영향',width:100,flex:0,...selectEditor(['긍정','중립','부정'])},{field:'related_assets',headerName:'관련 종목·섹터',minWidth:190},
  {field:'importance',headerName:'중요도(1~5)',width:105,flex:0,...selectEditor([1,2,3,4,5]),cellClassRules:{'rank-high':p=>Number(p.value)>=4}},
  {field:'next_review_date',headerName:'다음 확인일',width:120,flex:0},{field:'status',headerName:'상태',width:110,flex:0,...selectEditor(['관찰중','매매연결','완료','폐기'])},
  {field:'journal_no',headerName:'투자일지 No',width:105,flex:0},{field:'elapsed_days',headerName:'경과일(자동)',editable:false,width:100,flex:0},{field:'alert',headerName:'알림(자동)',editable:false,width:100,flex:0},
  {field:'market',headerName:'시장(자동)',editable:false,width:98,flex:0},{field:'ticker',headerName:'종목코드(자동)',editable:false,width:120,flex:0},
  {field:'name',headerName:'종목명(자동)',editable:false,minWidth:145},{field:'current_price',headerName:'현재가(자동)',editable:false,valueFormatter:p=>num(p.value)},
  {field:'sector',headerName:'섹터(자동)',editable:false,minWidth:135},{field:'industry',headerName:'산업(자동)',editable:false,minWidth:150},
  {field:'stage',headerName:'모멘텀 단계(자동)',editable:false,minWidth:150,valueFormatter:p=>stageLabel(p.value),cellClassRules:stageRules},{field:'verdict',headerName:'최종 판단(자동)',editable:false,minWidth:135},
  {field:'rs_rank',headerName:'RS순위(자동)',editable:false,width:100,flex:0,cellClassRules:{'rank-high':p=>Number(p.value)>=70,'rank-top':p=>Number(p.value)>=90}},
  {field:'analysis_no',headerName:'종목분석 No(자동)',editable:false,width:125,flex:0}
]
const analysisCols:ColDef<EditableRow>[]=[
  rowNo,
  {field:'date',headerName:'분석일',width:110,flex:0},{field:'ticker',headerName:'종목코드',pinned:'left',width:105,flex:0},{field:'name',headerName:'종목명',editable:false,minWidth:145},
  {field:'market',headerName:'시장',editable:false,width:78,flex:0},{field:'sector',headerName:'섹터(자동)',editable:false,minWidth:130},
  {field:'lynch_category',headerName:'린치 분류',minWidth:120,...selectEditor(['저성장','대형우량','고성장','경기순환','회생','자산주'])},
  {field:'eps_growth_q',headerName:'분기 EPS 성장률(YoY)',valueFormatter:p=>pct(p.value),cellClassRules:upDownRules},{field:'sales_growth_q',headerName:'분기 매출 성장률(YoY)',valueFormatter:p=>pct(p.value),cellClassRules:upDownRules},
  {field:'eps_growth_3y',headerName:'연간 EPS 성장률(3년 평균)',valueFormatter:p=>pct(p.value),cellClassRules:upDownRules},{field:'roe',headerName:'ROE',valueFormatter:p=>pct(p.value),cellClassRules:upDownRules},
  {field:'operating_margin',headerName:'영업이익률',valueFormatter:p=>pct(p.value),cellClassRules:upDownRules},{field:'debt_ratio',headerName:'부채비율',valueFormatter:p=>pct(p.value)},
  {field:'operating_cashflow_positive',headerName:'영업현금흐름',width:110,flex:0,...selectEditor([true,false]),valueFormatter:p=>p.value===true?'양수':p.value===false?'음수':'—'},
  {field:'pe',headerName:'PER'},{field:'peg',headerName:'PEG'},{field:'above_ma50',headerName:'50일선 위(자동)',editable:false,width:115,flex:0},{field:'above_ma200',headerName:'200일선 위(자동)',editable:false,width:120,flex:0},
  {field:'high_52w_distance',headerName:'52주 고점 대비(자동)',editable:false,width:135,flex:0,valueFormatter:p=>pct(p.value)},
  {field:'moat',headerName:'경쟁우위(해자)',minWidth:230},{field:'growth_driver',headerName:'성장 동력',minWidth:230},{field:'key_risk',headerName:'핵심 리스크',minWidth:230},
  {field:'pass_count',headerName:'통과 수(자동)',editable:false,width:105,flex:0},{field:'auto_grade',headerName:'자동 판정',editable:false,width:110,flex:0},{field:'conclusion',headerName:'내 결론',minWidth:150},
  {field:'research_note_no',headerName:'리서치노트 No',width:120,flex:0},{field:'journal_no',headerName:'투자일지 No',width:105,flex:0},
  {field:'stage',headerName:'리더보드 단계(자동)',editable:false,minWidth:150,valueFormatter:p=>stageLabel(p.value),cellClassRules:stageRules},{field:'industry',headerName:'산업(자동)',editable:false,minWidth:150},
  {field:'verdict',headerName:'최종 판단(자동)',editable:false,minWidth:135},{field:'rs_rank',headerName:'RS순위(자동)',editable:false,width:100,flex:0,cellClassRules:{'rank-high':p=>Number(p.value)>=70,'rank-top':p=>Number(p.value)>=90}},
  {field:'price',headerName:'현재가(자동)',editable:false,valueFormatter:p=>num(p.value)}
]
const journalCols:ColDef<EditableRow>[]=[
  rowNo,
  {field:'date',headerName:'날짜',width:110,flex:0},{field:'account',headerName:'계좌',width:95,flex:0,...selectEditor(['해외','키움','DC','ISA','연금'])},
  {field:'ticker',headerName:'종목코드',pinned:'left',width:105,flex:0},{field:'name',headerName:'종목명',editable:false,minWidth:140},{field:'tranche',headerName:'분할차수',width:95,flex:0,...selectEditor(['1차','2차','3차'])},
  {field:'buy_price',headerName:'매수가'},{field:'currency',headerName:'통화',width:80,flex:0,...selectEditor(['KRW','USD'])},{field:'thesis',headerName:'매수 이유(가설)',minWidth:300},
  {field:'evidence_type',headerName:'근거 유형',minWidth:110,...selectEditor(['펀더멘털','기술적','이벤트','매크로'])},{field:'confidence',headerName:'확신도(1~5)',width:100,flex:0,...selectEditor([1,2,3,4,5])},
  {field:'target_price',headerName:'목표가'},{field:'target_return',headerName:'목표수익률(자동)',editable:false,valueFormatter:p=>pct(p.value),cellClassRules:upDownRules},
  {field:'stop_price',headerName:'손절가'},{field:'stop_return',headerName:'손절률(자동)',editable:false,valueFormatter:p=>pct(p.value),cellClassRules:upDownRules},
  {field:'review_condition',headerName:'재검토 조건',minWidth:250},{field:'review_date',headerName:'재검토일',width:118,flex:0},{field:'status',headerName:'상태',width:110,flex:0,...selectEditor(['보유중','재검토중','목표달성','손절','청산'])},
  {field:'exit_date',headerName:'결과일',width:110,flex:0},{field:'sell_price',headerName:'매도가'},{field:'realized_return',headerName:'실현수익률(자동)',editable:false,valueFormatter:p=>pct(p.value),cellClassRules:upDownRules},
  {field:'thesis_hit',headerName:'가설 적중',width:105,flex:0,...selectEditor(['적중','부분적중','빗나감'])},{field:'review_note',headerName:'결과 복기',minWidth:250},{field:'lesson',headerName:'교훈',minWidth:250},
  {field:'stage',headerName:'리더보드 단계(자동)',editable:false,minWidth:150,valueFormatter:p=>stageLabel(p.value),cellClassRules:stageRules},{field:'market',headerName:'시장(자동)',editable:false,width:98,flex:0},
  {field:'current_price',headerName:'현재가(자동)',editable:false,valueFormatter:p=>num(p.value)},
  {field:'sector',headerName:'섹터(자동)',editable:false,minWidth:135},{field:'industry',headerName:'산업(자동)',editable:false,minWidth:150},{field:'verdict',headerName:'최종 판단(자동)',editable:false,minWidth:135},
  {field:'rs_rank',headerName:'RS순위(자동)',editable:false,width:100,flex:0,cellClassRules:{'rank-high':p=>Number(p.value)>=70,'rank-top':p=>Number(p.value)>=90}},
  {field:'analysis_no',headerName:'종목분석 No(자동)',editable:false,width:125,flex:0},{field:'research_no',headerName:'리서치노트 No(자동)',editable:false,width:135,flex:0}
]

function Kpi({label,value,sub,onClick}:{label:string;value:string|number;sub?:string;onClick?:()=>void}){
  const content=<><span>{label}</span><strong>{value}</strong>{sub&&<small>{sub}</small>}</>
  return onClick?<button type="button" className="kpi kpi-action" onClick={onClick} aria-label={`${label} ${value}종목 보기`}>{content}</button>:<div className="kpi">{content}</div>
}

function LeadershipCard({tone,icon,label,value,sub,onClick}:{tone:'green'|'blue'|'amber'|'violet';icon:string;label:string;value:number;sub:string;onClick:()=>void}){
  return <button type="button" className={'leadership-card '+tone} onClick={onClick} aria-label={`${label} ${value}종목 보기`}>
    <span className="leadership-card-icon" aria-hidden="true">{icon}</span>
    <span className="leadership-card-copy"><b>{label}</b><strong>{value}</strong><small>{sub}</small></span>
    <span className="leadership-card-count">{value} 종목</span>
  </button>
}

function MarketMetricCard({tone,icon,label,value,sub,progress}:{tone:'green'|'blue'|'violet'|'split'|'teal';icon:string;label:string;value:string;sub:string;progress?:number}){
  const safeProgress=progress==null?null:Math.max(0,Math.min(100,progress))
  return <div className={'market-metric-card '+tone}>
    <div className="market-metric-head"><span className="market-metric-icon" aria-hidden="true">{icon}</span><b>{label}</b></div>
    {/* Value and description sit on their own subgrid rows so every card in a row lines up. */}
    <div className="market-metric-reading market-metric-value"><strong>{value}</strong></div>
    <div className="market-metric-reading market-metric-sub"><small>{sub}</small></div>
    <div className="market-metric-track" aria-hidden="true">{safeProgress!=null&&<span style={{width:safeProgress+'%'}}/>}</div>
  </div>
}

function ValuePill({children,tone='gray'}:{children:any;tone?:string}){return <span className={'pill '+tone}>{children}</span>}

const tradingPeriods=['5D','20D','50D','120D','200D','52W'] as const
const ibdTitle=(r:LeaderRow)=>r.asset_class==='ETF'
  ? r.ibd_rs_as_of?`가격 기준 ${r.ibd_rs_as_of} · 같은 시장 ETF끼리 비교한 추정치(ETF-IBD-1)`:'ETF 가격 이력 253거래일 미만'
  : r.ibd_rs_as_of?`가격 기준 ${r.ibd_rs_as_of} · 공식 IBD 점수가 아닌 추정치`:'주식 가격 이력 253거래일 미만'
const rsTradingValues=(r:LeaderRow)=>[r.rs_5d,r.rs_20d,r.rs_50d,r.rs_120d,r.rs_200d,r.rs_12m]
const returnTradingValues=(r:LeaderRow)=>[r.return_5d,r.return_20d,r.return_50d,r.return_120d,r.return_200d,r.return_12m]

const STOCK_NAME_DEFAULT_WIDTH=102
const STOCK_NAME_MIN_WIDTH=80
const STOCK_NAME_MAX_WIDTH=360
const STOCK_NAME_WIDTH_KEY='peppercorn-stock-name-width-v3'
const SECTOR_NAME_DEFAULT_WIDTH=120
const SECTOR_NAME_MIN_WIDTH=80
const SECTOR_NAME_MAX_WIDTH=260
const SECTOR_NAME_WIDTH_KEY='peppercorn-sector-name-width-v1'

function useColumnWidth(key:string,initial:number,min:number,max:number){
  const [width,setWidth]=useState(()=>{
    try{
      const raw=localStorage.getItem(key)
      const saved=raw===null?initial:Number(raw)
      return Number.isFinite(saved)?Math.min(max,Math.max(min,saved)):initial
    }catch{return initial}
  })
  useEffect(()=>{
    try{localStorage.setItem(key,String(width))}catch{}
  },[key,width])
  const startResize=(event:any)=>{
    event.preventDefault();event.stopPropagation()
    const startX=event.clientX,startWidth=width
    const previousCursor=document.body.style.cursor,previousSelect=document.body.style.userSelect
    document.body.style.cursor='col-resize';document.body.style.userSelect='none'
    const move=(moveEvent:PointerEvent)=>setWidth(Math.min(max,Math.max(min,startWidth+moveEvent.clientX-startX)))
    const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);document.body.style.cursor=previousCursor;document.body.style.userSelect=previousSelect}
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',up)
  }
  return [width,startResize] as const
}

const etfRankTitle=`ETF끼리만 비교한 시장별 순위(${ETF_RS_RANK_VERSION}) · 주식 RS 순위와 별도`

// Diverging red(+)/gray/blue(−) scale for median benchmark-relative RS, matching the app's up-red/down-blue convention.
// Steps are lightness-matched per arm (relative luminance .11/.31 blue vs .11/.31 red); ink on light, white on dark (≥4.9:1).
const HEAT_THRESHOLDS:Record<EtfHeatPeriod,[number,number]>={'5D':[.01,.03],'20D':[.02,.06],'50D':[.03,.10],'120D':[.05,.15],'200D':[.07,.20],'52W':[.10,.30]}
const HEAT_MISSING={bg:'#e4e7eb',ink:'#5d6b7c'}
const heatColor=(value:number|null,[t1,t2]:[number,number])=>value==null?HEAT_MISSING
  :value>=t2?{bg:'#b3261e',ink:'#ffffff'}:value>=t1?{bg:'#e8766d',ink:'#202938'}
  :value<=-t2?{bg:'#1c5cab',ink:'#ffffff'}:value<=-t1?{bg:'#5598e7',ink:'#202938'}:{bg:'#f0efec',ink:'#202938'}
const pctLabel=(v:number)=>`${v>0?'+':''}${Math.round(v*100)}%`
const tradedLabel=(market:string,value:number)=>market==='KR'
  ?(value>=1e12?`${(value/1e12).toFixed(1)}조원`:value>=1e8?`${Math.round(value/1e8).toLocaleString('ko-KR')}억원`:`${Math.round(value/1e4).toLocaleString('ko-KR')}만원`)
  :(value>=1e9?`$${(value/1e9).toFixed(1)}B`:value>=1e6?`$${Math.round(value/1e6).toLocaleString('en-US')}M`:`$${Math.round(value/1e3).toLocaleString('en-US')}K`)

function useElementWidth<T extends HTMLElement>(){
  const ref=useRef<T|null>(null)
  const [width,setWidth]=useState(0)
  useLayoutEffect(()=>{
    const el=ref.current;if(!el)return
    setWidth(el.clientWidth)
    const observer=new ResizeObserver(entries=>setWidth(entries[0].contentRect.width))
    observer.observe(el)
    return()=>observer.disconnect()
  },[])
  return [ref,width] as const
}

// One market's treemap: tile area = industry's 20-session trading value, colour = median RS for the chosen period.
function EtfIndustryTreemap({market,groups,period,onSelect}:{market:string;groups:EtfIndustry[];period:EtfHeatPeriod;onSelect:(group:EtfIndustry)=>void}){
  const [ref,width]=useElementWidth<HTMLDivElement>()
  const height=width<520?300:340
  const rects=width?squarify(groups,g=>g.tradedValue,width,height):[]
  const total=groups.reduce((sum,g)=>sum+g.tradedValue,0)
  return <div className="etf-heat-market">
    <div className="etf-heat-market-head"><b>{market}</b><span>ETF 20일 평균 거래대금 합계 {tradedLabel(market,total)}</span></div>
    <div ref={ref} className="etf-heat-map" style={{height}} role="list" aria-label={`${market} ETF 주도 산업 히트맵`}>
      {rects.map(({item:g,x,y,w,h})=>{
        const name=etfIndustryLabel(g.market,g.industry),value=g.medRs[period],color=heatColor(value,HEAT_THRESHOLDS[period])
        const tip=`${name} · RS ${period} 중앙값 ${value==null?'—':pctLabel(value)} · 20일 평균 거래대금 ${tradedLabel(g.market,g.tradedValue)} · ETF ${g.n}개(거래대금 ${g.valued}개) · RS 순위 중앙값 ${g.medRank==null?'—':Math.round(g.medRank)} · TT 통과 ${g.ttPass} · 최상위 ${g.leader}`
        return <button key={g.key} type="button" role="listitem" className="etf-heat-tile" title={tip} aria-label={tip} onClick={()=>onSelect(g)}
          style={{left:x+1,top:y+1,width:Math.max(0,w-2),height:Math.max(0,h-2),background:color.bg,color:color.ink}}>
          {w>=64&&h>=40&&<><b>{name}</b><strong>{value==null?'—':pctLabel(value)}</strong></>}
          {w>=64&&h>=72&&<small>ETF {g.n} · {tradedLabel(g.market,g.tradedValue)}</small>}
        </button>
      })}
    </div>
  </div>
}

function EtfIndustryHeatmap({groups,markets,period,onSelect}:{groups:EtfIndustry[];markets:string[];period:EtfHeatPeriod;onSelect:(group:EtfIndustry)=>void}){
  const sized=groups.filter(g=>g.tradedValue>0)
  const missing=groups.length-sized.length
  const [t1,t2]=HEAT_THRESHOLDS[period]
  const keys=[{v:-t2,label:`≤ ${pctLabel(-t2)}`},{v:-t1,label:`${pctLabel(-t2)} ~ ${pctLabel(-t1)}`},{v:0,label:`± ${Math.round(t1*100)}% 미만`},{v:t1,label:`${pctLabel(t1)} ~ ${pctLabel(t2)}`},{v:t2,label:`≥ ${pctLabel(t2)}`}]
  if(!sized.length)return <p className="empty">거래대금이 집계된 산업 ETF가 없습니다.</p>
  return <>
    {markets.map(m=>{const list=sized.filter(g=>g.market===m);return list.length?<EtfIndustryTreemap key={m} market={m} groups={list} period={period} onSelect={onSelect}/>:null})}
    <div className="etf-heat-legend" aria-label={`색상 범례: RS ${period} 중앙값`}>
      <span>RS {period} 중앙값</span>
      {keys.map(k=><span key={k.label} className="etf-heat-key"><i style={{background:heatColor(k.v,HEAT_THRESHOLDS[period]).bg}}/>{k.label}</span>)}
      <span className="etf-heat-key"><i style={{background:HEAT_MISSING.bg}}/>데이터 없음</span>
      {missing>0&&<span>· 거래대금 없는 산업 {missing}개 제외</span>}
    </div>
  </>
}

// Shared stock/ETF table. A caller may pass a name-column width it owns (the ETF summary shares the sector column width).
const liveQuoteTime=(q:LiveQuote)=>q.time?new Date(q.time).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}):''
const liveQuoteTitle=(q:LiveQuote)=>`실시간 현재가${q.time?' · '+liveQuoteTime(q)+' 기준':''} · 30초마다 새로고침 (등락·RS는 일간 집계)`

function LiveGridTable(props:Parameters<typeof GridTable>[0]){
  const live=useLiveQuotes(props.rows.filter(r=>r.ticker&&r.market).map(r=>({market:r.market as LeaderRow['market'],ticker:String(r.ticker),exchange:(r.exchange as string|null|undefined)??null})),120)
  const rows=props.rows.map(r=>{const q=r.ticker&&r.market?live({market:r.market as LeaderRow['market'],ticker:String(r.ticker),exchange:(r.exchange as string|null|undefined)??null}):null;return q?{...r,current_price:q.price,price:q.price}:r})
  return <GridTable {...props} rows={rows}/>
}

function StockRows({rows,onSelect,label='종목',nameWidth,onResizeStart}:{rows:LeaderRow[];onSelect:(row:LeaderRow)=>void;label?:string;nameWidth?:number;onResizeStart?:(event:any)=>void}){
  const [ownWidth,startOwnResize]=useColumnWidth(STOCK_NAME_WIDTH_KEY,STOCK_NAME_DEFAULT_WIDTH,STOCK_NAME_MIN_WIDTH,STOCK_NAME_MAX_WIDTH)
  const width=nameWidth??ownWidth
  const live=useLiveQuotes(rows)
  return <div className="stock-rows" style={{'--stock-name-width':`${width}px`} as CSSProperties}><div className="stock-rows-head"><span className="stock-name-head">{label}<button type="button" className="stock-column-resizer" aria-label={`${label} 열 너비 조절`} title={`드래그하여 ${label} 열 너비 조절`} onPointerDown={onResizeStart??startOwnResize}/></span><span>현재가</span><span>단계</span><span>RS 순위</span><span>IBD식 RS</span>{tradingPeriods.map(period=><span key={'rs'+period}>RS {period}</span>)}{tradingPeriods.map(period=><span key={'return'+period}>등락 {period}</span>)}<span>52W 고점 대비</span></div>{rows.map(r=><button key={r.id} className="stock-row" onClick={()=>onSelect(r)}>
    <div className="stock-id" title={`${r.name} · ${r.ticker}`}><b>{r.name}</b><small>{r.market} · {r.ticker} · {r.industry}</small></div>{(q=><span className={'stock-price'+(q?' live-price':'')} title={q?liveQuoteTitle(q):'일간 종가 기준'}>{num(q?.price??r.price)}</span>)(live(r))}<ValuePill tone={stageTone(r.stage)}>{stageLabel(r.stage)}</ValuePill>{(rank=><strong className={(rank??0)>=90?'rank rank-top':(rank??0)>=70?'rank rank-high':'rank'} title={r.asset_class==='ETF'?etfRankTitle:undefined}>{rank??'—'}</strong>)(r.asset_class==='ETF'?r.etf_rs_rank:r.rs_rank)}<strong className={(r.ibd_rs_estimate??0)>=90?'rank rank-top':(r.ibd_rs_estimate??0)>=80?'rank rank-high':'rank'} title={ibdTitle(r)}>{r.ibd_rs_estimate??'—'}</strong>
    {[...rsTradingValues(r),...returnTradingValues(r),r.high_52w_distance].map((value,i)=><span key={i} className={value!=null&&value>0?'pos':value!=null&&value<0?'neg':''}>{pct(value)}</span>)}
  </button>)}{!rows.length&&<div className="empty">선택한 범위에 해당 종목이 없습니다.</div>}</div>
}

function SnapshotItem({label,children,wide=false,valueClassName=''}:{label:string;children:any;wide?:boolean;valueClassName?:string}){
  return <div className={'snapshot-item'+(wide?' wide':'')}><span>{label}</span><strong className={valueClassName}>{children}</strong></div>
}

function StockSnapshot({row,onRefresh,refreshing}:{row:LeaderRow;onRefresh:()=>void;refreshing:boolean}){
  const ma200Gap=gapPct(row.price,row.ma200)
  const ma200Status=row.price!=null&&row.ma200!=null?(Number(row.price)>=Number(row.ma200)?'위 ':'아래 ')+ma200Gap:'—'
  const indexes=row.index_memberships?.length?row.index_memberships.join(' · '):'—'
  const rsItems=tradingPeriods.map((period,i)=>[period,rsTradingValues(row)[i]] as const)
  const retItems=tradingPeriods.map((period,i)=>[period,returnTradingValues(row)[i]] as const)
  const liveQuote=useLiveQuotes([row],1)(row)
  return <div className="stock-snapshot">
    <div className="external-links drill-animate">
      <a target="_blank" rel="noreferrer" href={tradingViewUrl(row)}>TradingView ↗</a>
      {row.market==='US'&&<a target="_blank" rel="noreferrer" href={saveTickerUrl(row)}>SaveTicker ↗</a>}
      <a target="_blank" rel="noreferrer" href={SHEET_URL}>Google Sheet ↗</a>
    </div>
    <section className="snapshot-section leadership-section drill-animate">
      <div className="snapshot-section-head"><div><span>01</span><h3>리더십 · 분류</h3></div><ValuePill tone={leadTone(leadership(row))}>{leadership(row)}</ValuePill></div>
      <div className="leadership-hero">
        {row.asset_class==='ETF'
          ?<div className="leadership-score" title={etfRankTitle}><span>ETF RS순위</span><strong>{row.etf_rs_rank??'—'}</strong></div>
          :<div className="leadership-score"><span>RS순위</span><strong>{row.rs_rank??'—'}</strong></div>}
        <div className="leadership-score ibd-score" title={ibdTitle(row)}><span>IBD식 RS</span><strong>{row.ibd_rs_estimate??'—'}</strong></div>
        <div className="leadership-copy"><span>최종 판단</span><ValuePill tone={stageTone(row.stage)}>{row.verdict||'—'}</ValuePill><small>{row.stage||'—'}</small></div>
      </div>
      <p className="classification-summary">{row.market} · {sectorName(row.market,row.sector||'분류 확인')} · {row.industry||'분류 확인'} · {row.exchange||row.market}</p>
      <p className="classification-meta" title={row.classification_source||undefined}>지수 {indexes} · 데이터 {row.data_status||'정상'}{row.classification_as_of&&` · 분류 ${row.classification_as_of}`}{row.classification_source&&` · 출처 ${sourceName(row.classification_source)}`}</p>
    </section>
    <section className="snapshot-section drill-animate">
      <div className="snapshot-section-head"><div><span>02</span><h3>상대강도</h3></div><div><small>벤치마크 대비</small><button className="snapshot-refresh" aria-label="RS 새로고침" disabled={refreshing} onClick={onRefresh}>↻</button></div></div>
      <div className="signal-strip">{rsItems.map(([label,value])=><div key={label}><span>RS {label}</span><strong className={Number(value)>0?'pos':Number(value)<0?'neg':''}>{pct(value)}</strong></div>)}</div>
    </section>
    <section className="snapshot-section drill-animate">
      <div className="snapshot-section-head"><div><span>03</span><h3>가격 모멘텀</h3></div><small>기간 수익률</small></div>
      <div className="signal-strip">{retItems.map(([label,value])=><div key={label}><span>등락 {label}</span><strong className={Number(value)>0?'pos':Number(value)<0?'neg':''}>{pct(value)}</strong></div>)}</div>
    </section>
    <section className="snapshot-section drill-animate">
      <div className="snapshot-section-head"><div><span>04</span><h3>추세 · 리스크</h3></div></div>
      <div className="snapshot-grid technical-grid">
        <SnapshotItem label="현재가" valueClassName={liveQuote?'live-price':''}>{num(liveQuote?.price??row.price)}{liveQuote?<small className="live-badge" title={liveQuoteTitle(liveQuote)}>실시간{liveQuote.time?' '+liveQuoteTime(liveQuote):''}</small>:<small className="live-badge off">일간 종가</small>}</SnapshotItem>
        <SnapshotItem label="MA50 이격">{gapPct(row.price,row.ma50)}</SnapshotItem>
        <SnapshotItem label="200일선">{ma200Status}</SnapshotItem>
        <SnapshotItem label="52W 고점 대비" valueClassName={row.high_52w_distance!=null&&row.high_52w_distance>0?'pos':row.high_52w_distance!=null&&row.high_52w_distance<0?'neg':''}>{pct(row.high_52w_distance)}</SnapshotItem>
        <SnapshotItem label="거래량">{row.volume_ratio==null?'—':Number(row.volume_ratio).toFixed(2)+'x'}</SnapshotItem>
        <SnapshotItem label="RSI(14)">{row.rsi14==null?'—':Number(row.rsi14).toFixed(0)}</SnapshotItem>
        <SnapshotItem label="ATR배수">{row.atr_multiple==null?'—':Number(row.atr_multiple).toFixed(1)+'x'}</SnapshotItem>
        <SnapshotItem label="ADR20">{pct(row.adr20_pct)}</SnapshotItem>
      </div>
    </section>
  </div>
}

function TickerEntry({onAdd}:{onAdd:(ticker:string)=>string|null}){
  const [ticker,setTicker]=useState('')
  const [error,setError]=useState('')
  return <form className="ticker-entry" onSubmit={event=>{
    event.preventDefault()
    const message=onAdd(ticker)
    setError(message||'')
    if(!message)setTicker('')
  }}>
    <label htmlFor="new-ticker">종목코드로 기록 추가</label>
    <input id="new-ticker" value={ticker} onChange={event=>{setTicker(event.target.value);setError('')}} placeholder="예: AAPL · 005930 · KR:005930" aria-invalid={!!error}/>
    <button type="submit">추가</button>
    {error&&<span className="ticker-entry-error" role="alert">{error}</span>}
  </form>
}

export default function App(){
  const [showIntro,setShowIntro]=useState(()=>{
    try{return sessionStorage.getItem('peppercorn-intro-seen')!=='1'}catch{return true}
  })
  const [page,setPage]=useState('dashboard')
  const [menuOpen,setMenuOpen]=useState(false)
  const [leaders,setLeaders]=useState<LeaderRow[]>([])
  const [source,setSource]=useState<'demo'|'supabase'>('demo')
  const [refreshing,setRefreshing]=useState(false)
  const refreshingRef=useRef(false)
  const sourceRef=useRef<'demo'|'supabase'>('demo')
  const lastLoadRef=useRef(0)
  const [market,setMarket]=useState<'ALL'|Market>('ALL')
  const [query,setQuery]=useState('')
  const [sector,setSector]=useState<string|null>(null)
  const [sectorKeySelected,setSectorKeySelected]=useState<string|null>(null)
  const [sectorSummaryOpen,setSectorSummaryOpen]=useState(false)
  const [sectorNameWidth,startSectorColumnResize]=useColumnWidth(SECTOR_NAME_WIDTH_KEY,SECTOR_NAME_DEFAULT_WIDTH,SECTOR_NAME_MIN_WIDTH,SECTOR_NAME_MAX_WIDTH)
  const [etfSummaryOpen,setEtfSummaryOpen]=useState(false)
  const [etfIndustryKey,setEtfIndustryKey]=useState<string|null>(null)
  const [etfHeatPeriod,setEtfHeatPeriod]=useState<EtfHeatPeriod>('20D')
  const [stockTab,setStockTab]=useState<'core'|'candidates'|'turns'|'corrections'>('core')
  const [summaryTab,setSummaryTab]=useState<'core'|'candidates'|'turns'|'corrections'|null>(null)
  const [selected,setSelected]=useState<LeaderRow|null>(null)
  const [drillSectorKey,setDrillSectorKey]=useState<string|null>(null)
  const [drillStock,setDrillStock]=useState<LeaderRow|null>(null)
  const [analysisDeleteTarget,setAnalysisDeleteTarget]=useState<EditableRow|null>(null)
  const drillRef=useRef<HTMLDivElement|null>(null)
  const launchRef=useRef<HTMLDivElement|null>(null)
  const analysisRecordsRef=useRef<HTMLDivElement|null>(null)
  const [scrollToAnalysis,setScrollToAnalysis]=useState(false)
  const [watch,setWatch]=useLocalRows<EditableRow>('peppercorn-watchlist',initialWatchlist)
  const [portfolio,setPortfolio]=useLocalRows<EditableRow>('peppercorn-portfolio',initialPortfolio)
  const [research,setResearch]=useLocalRows<EditableRow>('peppercorn-research',initialResearch)
  const [analysis,setAnalysis]=useLocalRows<EditableRow>('peppercorn-analysis',initialAnalysis)
  const [journal,setJournal]=useLocalRows<EditableRow>('peppercorn-journal',initialJournal)
  const [session,setSessionState]=useState<Session|null>(()=>loadStoredSession())
  const [authOpen,setAuthOpen]=useState(false)
  const [syncState,setSyncState]=useState<'local'|'loading'|'saving'|'saved'|'error'>(session?'loading':'local')
  const drillOpen=!!drillStock||!!summaryTab||drillSectorKey!==null
  const compactStockLayout=()=>window.matchMedia('(max-width: 1279px)').matches
  const showStockGroup=(tab:'core'|'candidates'|'turns'|'corrections')=>{
    setStockTab(tab);setSector(null);setSectorKeySelected(null)
    setSummaryTab(tab);setDrillSectorKey(null);setDrillStock(null)
  }

  const updateSession=(next:Session|null)=>{setSessionState(next);storeSession(next);setSyncState(next?'saved':'local')}
  const sectorTableStyle={'--sector-name-width':`${sectorNameWidth}px`} as CSSProperties

  const refreshLeaderboard=async()=>{
    if(refreshingRef.current)return
    refreshingRef.current=true;setRefreshing(true)
    try{
      const result=await loadLeaderboard()
      lastLoadRef.current=Date.now()
      // A transient connection failure must not replace loaded live rows with demo data.
      if(result.source==='demo'&&sourceRef.current==='supabase')return
      sourceRef.current=result.source
      const rows=withEtfRanks(applyKrEtfNames(result.rows))
      setLeaders(rows);setSource(result.source)
      const matching=(row:LeaderRow|null)=>rows.find(r=>r.market===row?.market&&r.ticker===row?.ticker)
      setSelected(previous=>matching(previous)??rows[0]??null)
      setDrillStock(previous=>previous?matching(previous)??null:null)
    }finally{
      refreshingRef.current=false;setRefreshing(false)
    }
  }
  useEffect(()=>{
    void refreshLeaderboard()
    const onVisible=()=>{
      if(document.visibilityState==='visible'&&Date.now()-lastLoadRef.current>5*60_000)void refreshLeaderboard()
    }
    document.addEventListener('visibilitychange',onVisible)
    const interval=window.setInterval(()=>{
      if(document.visibilityState==='visible'&&Date.now()-lastLoadRef.current>15*60_000)void refreshLeaderboard()
    },60_000)
    return()=>{document.removeEventListener('visibilitychange',onVisible);window.clearInterval(interval)}
  },[])
  useLayoutEffect(()=>{
    const root=launchRef.current
    if(!showIntro||!root)return
    const icon=root.querySelector<HTMLElement>('.launch-emblem')
    const wordmark=root.querySelector<HTMLElement>('.launch-wordmark')
    const footer=root.querySelector<HTMLElement>('.launch-footer')
    const slogan=root.querySelector<HTMLElement>('.launch-slogan')
    const description=root.querySelector<HTMLElement>('.launch-description')
    const progress=root.querySelector<HTMLElement>('.launch-progress span')
    const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const finish=()=>{
      try{sessionStorage.setItem('peppercorn-intro-seen','1')}catch{}
      setShowIntro(false)
    }
    // A suspended animation must never leave the dashboard covered.
    const fallback=window.setTimeout(finish,5300)
    const context=gsap.context(()=>{
      gsap.set(progress,{scaleX:0})
      if(!reduceMotion){
        gsap.set([icon,wordmark,slogan,description,footer],{autoAlpha:0})
      }
      const timeline=gsap.timeline({onComplete:finish})
      if(!reduceMotion){
        timeline.fromTo(icon,{y:12,scale:.95,autoAlpha:0,rotationX:9,rotationY:-11,transformPerspective:420},{y:0,scale:1,autoAlpha:1,rotationX:9,rotationY:-11,transformPerspective:420,duration:.8,ease:'power2.out'},.15)
          .fromTo(wordmark,{x:-8,autoAlpha:0},{x:0,autoAlpha:1,duration:.65,ease:'power2.out'},.45)
          .fromTo(slogan,{y:8,autoAlpha:0},{y:0,autoAlpha:1,duration:.65,ease:'power2.out'},.9)
          .fromTo(description,{y:6,autoAlpha:0},{y:0,autoAlpha:1,duration:.7,ease:'power2.out'},1.1)
          .fromTo(footer,{autoAlpha:0},{autoAlpha:1,duration:.65,ease:'power2.out'},1.2)
      }
      timeline.to(progress,{scaleX:1,duration:4.35,ease:'none'},0)
        .to(root,{autoAlpha:0,duration:.65,ease:'power2.inOut'},4.35)
    },root)
    return()=>{window.clearTimeout(fallback);context.revert()}
  },[showIntro])
  useEffect(()=>{setSector(null);setSectorKeySelected(null);setSummaryTab(null);setDrillSectorKey(null);setDrillStock(null)},[market])
  useEffect(()=>{
    if(!drillOpen||!drillRef.current||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return
    const root=drillRef.current
    const compact=compactStockLayout()
    const tween=gsap.fromTo(root,compact?{y:44,opacity:0}:{x:44,opacity:0},{x:0,y:0,opacity:1,duration:.4,ease:'power3.out'})
    return()=>{tween.kill()}
  },[drillOpen])

  useEffect(()=>{
    if(!drillOpen||!drillRef.current||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return
    const root=drillRef.current
    const ctx=gsap.context(()=>{
      gsap.fromTo('.drill-content .drill-animate',{y:9,opacity:0},{y:0,opacity:1,duration:.3,stagger:.045,ease:'power2.out'})
    },root)
    return()=>ctx.revert()
  },[drillOpen,drillStock?.id,drillSectorKey,summaryTab])

  useEffect(()=>{
    if(page==='analysis'&&scrollToAnalysis){analysisRecordsRef.current?.scrollIntoView({behavior:'smooth',block:'start'});setScrollToAnalysis(false)}
  },[page,scrollToAnalysis])

  useEffect(()=>{
    if(!session) return
    let cancelled=false
    setSyncState('loading')
    Promise.all([
      loadWorkspace(session,'watchlist'),loadWorkspace(session,'portfolio'),loadWorkspace(session,'research'),loadWorkspace(session,'analysis'),loadWorkspace(session,'journal')
    ]).then(([w,p,r,a,j])=>{
      if(cancelled) return
      setWatch(w.rows);setPortfolio(p.rows);setResearch(r.rows);setAnalysis(a.rows);setJournal(j.rows)
      if(w.session.access_token!==session.access_token) updateSession(w.session)
      setSyncState('saved')
    }).catch(()=>{if(!cancelled)setSyncState('error')})
    return()=>{cancelled=true}
  },[session?.user?.id])

  const syncRows=async(resource:WorkspaceResource,rows:EditableRow[])=>{
    if(!session){setSyncState('local');return}
    setSyncState('saving')
    try{
      const result=await saveWorkspace(session,resource,rows)
      if(result.session.access_token!==session.access_token) updateSession(result.session)
      setSyncState('saved')
    }catch{setSyncState('error')}
  }
  const updateWatch=(rows:EditableRow[])=>{setWatch(rows);void syncRows('watchlist',rows)}
  const updatePortfolio=(rows:EditableRow[])=>{setPortfolio(rows);void syncRows('portfolio',rows)}
  const updateResearch=(rows:EditableRow[])=>{setResearch(rows);void syncRows('research',rows)}
  const updateAnalysis=(rows:EditableRow[])=>{setAnalysis(rows);void syncRows('analysis',rows)}
  const updateJournal=(rows:EditableRow[])=>{setJournal(rows);void syncRows('journal',rows)}

  const marketRows=useMemo(()=>leaders.filter(r=>market==='ALL'||r.market===market),[leaders,market])
  const visible=useMemo(()=>{
    const q=query.trim().toLowerCase()
    return marketRows.filter(r=>!q||[r.ticker,r.name,r.sector,sectorName(r.market,r.sector),r.industry].map(v=>String(v||'')).join(' ').toLowerCase().includes(q))
  },[marketRows,query])
  const stockRows=marketRows.filter(r=>r.asset_class==='Equity')
  const rankedEtfRows=marketRows.filter(r=>r.asset_class==='ETF').sort((a,b)=>(b.etf_rs_rank??-1)-(a.etf_rs_rank??-1)||a.market.localeCompare(b.market)||a.ticker.localeCompare(b.ticker))
  const etfIndustries=buildEtfIndustries(marketRows)
  const chosenEtfIndustry=etfIndustries.find(g=>g.key===etfIndustryKey)||null
  const dialogEtfRows=chosenEtfIndustry?rankedEtfRows.filter(r=>`${r.market}|${String(r.industry||'').trim()}`===chosenEtfIndustry.key):rankedEtfRows
  const openEtfIndustry=(g:EtfIndustry)=>{setEtfIndustryKey(g.key);setEtfSummaryOpen(true)}
  const openEtf=(row:LeaderRow)=>{setEtfSummaryOpen(false);setEtfIndustryKey(null);setSelected(row);setSummaryTab(null);setDrillSectorKey(null);setDrillStock(row)}
  const metricExchanges=[...new Set(stockRows.map(r=>r.exchange?.trim()).filter((name):name is string=>!!name))].sort((a,b)=>a.localeCompare(b,'ko'))
  const metricIndices=[...new Set(stockRows.flatMap(r=>r.index_memberships||[]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko'))
  const metricNames=(names:string[])=>names.length?names.slice(0,3).join(' · ')+(names.length>3?` 외 ${names.length-3}`:''):'분류 확인 중'
  const metricContext=`${market==='ALL'?'전체':market} · 거래소 ${metricNames(metricExchanges)} · 지수 ${metricNames(metricIndices)}`
  const summaryGroups={
    core:stockRows.filter(r=>leadership(r)==='핵심 주도'),
    candidates:stockRows.filter(r=>leadership(r)==='주도 후보'),
    turns:stockRows.filter(r=>leadership(r)==='강세 전환'),
    corrections:stockRows.filter(isCorrection)
  }
  const leadCount=summaryGroups.core.length
  const candidateCount=summaryGroups.candidates.length
  const turnCount=summaryGroups.turns.length
  const correctionCount=summaryGroups.corrections.length
  const ma50Rows=stockRows.filter(r=>r.price!=null&&r.ma50!=null)
  const ma200Rows=stockRows.filter(r=>r.price!=null&&r.ma200!=null)
  const breadth=ma50Rows.length?ma50Rows.filter(r=>Number(r.price)>Number(r.ma50)).length/ma50Rows.length:0
  const ma200Breadth=ma200Rows.length?ma200Rows.filter(r=>Number(r.price)>Number(r.ma200)).length/ma200Rows.length:0
  const high52Rows=stockRows.filter(r=>r.high_52w_distance!=null)
  const highNearCount=high52Rows.filter(r=>Number(r.high_52w_distance)>=-.10).length
  const highNearShare=high52Rows.length?highNearCount/high52Rows.length:0
  const advanceCount=stockRows.filter(r=>(r.return_1w??0)>0).length
  const declineCount=stockRows.filter(r=>(r.return_1w??0)<0).length
  const advanceDeclineRatio=declineCount?advanceCount/declineCount:advanceCount?advanceCount:0
  const averageRs=avg(stockRows.map(r=>r.rs_rank))

  const allSectorRows=useMemo(()=>buildSectors(marketRows),[marketRows])
  const eligibleSectors=allSectorRows
  const sectorLabel=(g:SectorSummary)=>`${market==='ALL'?g.market+' · ':''}${sectorName(g.market,g.sector)}`
  const sectorOptions=eligibleSectors.slice().sort((a,b)=>sectorLabel(a).localeCompare(sectorLabel(b),'ko'))
  const shownSectors=sector?eligibleSectors.filter(g=>g.key===sector):eligibleSectors
  const rankedSectorRows=shownSectors.slice().sort((a,b)=>(b.medRank??-1)-(a.medRank??-1)||b.core-a.core)
  const dashboardTopSectors=rankedSectorRows.slice(0,5)
  const chosenSector=allSectorRows.find(g=>g.key===sectorKeySelected)||null
  const drillSector=allSectorRows.find(g=>g.key===drillSectorKey)||null
  const drillSectorStocks=visible.filter(r=>r.asset_class==='Equity'&&(!drillSector||sectorKey(r)===drillSector.key)).sort((a,b)=>(b.rs_rank??0)-(a.rs_rank??0))
  const drillStockGroups={
    core:drillSectorStocks.filter(r=>leadership(r)==='핵심 주도'),
    candidates:drillSectorStocks.filter(r=>leadership(r)==='주도 후보'),
    turns:drillSectorStocks.filter(r=>leadership(r)==='강세 전환'),
    corrections:drillSectorStocks.filter(isCorrection)
  }
  const scopedStocks=visible.filter(r=>r.asset_class==='Equity'&&(!sector||sectorKey(r)===sector)&&(!chosenSector||sectorKey(r)===chosenSector.key))
  const stockGroups={
    core:scopedStocks.filter(r=>leadership(r)==='핵심 주도'),
    candidates:scopedStocks.filter(r=>leadership(r)==='주도 후보'),
    turns:scopedStocks.filter(r=>leadership(r)==='강세 전환'),
    corrections:scopedStocks.filter(isCorrection)
  }
  const tabStocks=stockGroups[stockTab].slice().sort((a,b)=>(b.rs_rank??0)-(a.rs_rank??0))

  const leaderMap=useMemo(()=>{
    const m=new Map<string,LeaderRow>()
    for(const r of leaders){const ticker=String(r.ticker||'');const name=String(r.name||'');m.set(`${r.market}|${ticker}`,r);if(ticker&&!m.has(ticker))m.set(ticker,r);if(name)m.set(name.toLowerCase(),r)}
    return m
  },[leaders])
  const matchLeader=(row:EditableRow)=>{
    const ticker=String(row.ticker||'').trim().toUpperCase()
    const marketKey=row.market&&ticker?`${row.market}|${ticker}`:''
    const candidates=[marketKey,ticker,String(row.related_assets||'').split(/[ ,/]/)[0].toUpperCase(),String(row.target||'').trim().toLowerCase()]
    for(const k of candidates){if(k&&leaderMap.has(k))return leaderMap.get(k)||null}
    return null
  }
  const enrich=(rows:EditableRow[]):EditableRow[]=>rows.map(r=>{
    const l=matchLeader(r);if(!l)return r
    return {...r,market:l.market,ticker:l.ticker,exchange:l.exchange??null,name:l.name,sector:l.sector,industry:l.industry,stage:stageLabel(l.stage),leadership_class:leadership(l),verdict:l.verdict,rs_rank:l.rs_rank,current_price:l.price,price:l.price,ma50:l.ma50,ma200:l.ma200,high_52w_distance:l.high_52w_distance,volume_ratio:l.volume_ratio,rsi14:l.rsi14,rs_5d:l.rs_5d??null,rs_20d:l.rs_20d??null,rs_50d:l.rs_50d??null,rs_120d:l.rs_120d??null,rs_200d:l.rs_200d??null,return_5d:l.return_5d??null,return_20d:l.return_20d??null,return_50d:l.return_50d??null,return_120d:l.return_120d??null,return_200d:l.return_200d??null}
  })
  const baseResearch=enrich(research)
  const baseAnalysis=enrich(analysis)
  const analysisNoByTicker=new Map(baseAnalysis.filter(r=>r.ticker).map((r,i)=>[String(r.ticker),i+1]))
  const researchNoByTicker=new Map(baseResearch.filter(r=>r.ticker).map((r,i)=>[String(r.ticker),i+1]))
  const today=new Date();today.setHours(0,0,0,0)
  const enrichedResearch=baseResearch.map((r,i)=>{
    const d=r.date?new Date(String(r.date)):null
    const elapsed=d&&!Number.isNaN(d.getTime())?Math.floor((today.getTime()-d.getTime())/86400000):null
    const review=r.next_review_date?new Date(String(r.next_review_date)):null
    const alert=review&&!Number.isNaN(review.getTime())&&review<today&&!['완료','폐기'].includes(String(r.status||''))?'⚠ 확인':''
    return {...r,no:i+1,verification:r.verification||(r.verified===true?'확인됨':r.verified===false?'반박됨':'미검증'),elapsed_days:elapsed==null?'':elapsed+'일',alert,analysis_no:analysisNoByTicker.get(String(r.ticker||''))||''}
  })
  const enrichedAnalysis=baseAnalysis.map((r,i)=>{
    const yes50=Number(r.price)>Number(r.ma50),yes200=Number(r.price)>Number(r.ma200)
    const score=(Number(r.eps_growth_q)>=.25?1:0)+(Number(r.sales_growth_q)>=.20?1:0)+(Number(r.eps_growth_3y)>=.25?1:0)+(Number(r.roe)>=.17?1:0)+(Number(r.operating_margin)>=.10?1:0)+(Number(r.debt_ratio)<=1&&r.debt_ratio!==null&&r.debt_ratio!==''?1:0)+(r.operating_cashflow_positive===true?1:0)+(Number(r.peg)<=1&&r.peg!==null&&r.peg!==''?1:0)+(yes50&&yes200?1:0)+(Number(r.high_52w_distance)>=-.25?1:0)
    return {...r,no:i+1,above_ma50:r.ticker?(yes50?'Y':'N'):'',above_ma200:r.ticker?(yes200?'Y':'N'):'',pass_count:r.ticker?score+'/10':'',auto_grade:r.ticker?(score>=8?'매수후보':score>=5?'관찰':'제외'):'',research_note_no:r.research_note_no||researchNoByTicker.get(String(r.ticker||''))||''}
  })
  const enrichedJournal=enrich(journal).map((r,i)=>{
    const buy=Number(r.buy_price),target=Number(r.target_price),stop=Number(r.stop_price),sell=Number(r.sell_price)
    const validBuy=Number.isFinite(buy)&&buy!==0
    return {...r,no:i+1,target_return:validBuy&&Number.isFinite(target)&&target!==0?target/buy-1:null,stop_return:validBuy&&Number.isFinite(stop)&&stop!==0?stop/buy-1:null,realized_return:validBuy&&Number.isFinite(sell)&&sell!==0?sell/buy-1:r.realized_return,analysis_no:analysisNoByTicker.get(String(r.ticker||''))||'',research_no:researchNoByTicker.get(String(r.ticker||''))||''}
  })
  const analysisTableCols=useMemo<ColDef<EditableRow>[]>(()=>[...analysisCols,{
    headerName:'관리',width:82,flex:0,pinned:'right',editable:false,sortable:false,filter:false,
    cellRenderer:(p:any)=><button className="grid-delete" onClick={(e)=>{e.stopPropagation();if(p.data)setAnalysisDeleteTarget(p.data)}}>삭제</button>
  }],[])

  const filters=<div className="toolbar">
    <div className="segment">{(['ALL','KR','US'] as const).map(m=><button key={m} className={market===m?'on':''} onClick={()=>setMarket(m)}>{m==='ALL'?'전체':m}</button>)}</div>
    <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Ticker · 종목 · 산업 · 섹터 검색"/>
  </div>

  const recordAnalysis=(row:LeaderRow,navigate=false)=>{
    setSelected(row)
    updateAnalysis([{id:crypto.randomUUID(),date:new Date().toISOString().slice(0,10),market:row.market,ticker:row.ticker,name:row.name},...analysis])
    if(navigate){setSummaryTab(null);setDrillSectorKey(null);setDrillStock(null);setPage('analysis')}
    setScrollToAnalysis(true)
  }
  const addTickerRecord=(resource:WorkspaceResource,input:string):string|null=>{
    const raw=input.trim().toUpperCase()
    if(!raw)return '종목코드를 입력해 주세요.'
    const prefix=raw.match(/^(US|KR)[:\s-]+(.+)$/)
    const requestedMarket=prefix?prefix[1]:null
    const symbol=(prefix?prefix[2]:raw).trim()
    const ticker=/^\d{1,6}$/.test(symbol)?symbol.padStart(6,'0'):symbol
    const candidates=leaders.filter(r=>r.asset_class==='Equity'&&r.ticker.toUpperCase()===ticker&&(!requestedMarket||r.market===requestedMarket))
    const matches=!requestedMarket&&candidates.length>1&&market!=='ALL'?candidates.filter(r=>r.market===market):candidates
    if(!matches.length)return '리더보드에 없는 종목코드입니다. 시장 데이터가 연결된 종목을 입력해 주세요.'
    if(matches.length>1)return '동일한 코드가 여러 시장에 있습니다. US: 또는 KR:을 붙여 주세요.'
    const row=matches[0]
    if(resource==='analysis'){recordAnalysis(row);return null}
    const common={id:crypto.randomUUID(),market:row.market,ticker:row.ticker,name:row.name}
    if(resource==='research')updateResearch([{...common,date:new Date().toISOString().slice(0,10),type:'종목',target:row.name,related_assets:row.ticker,verification:'미검증',status:'관찰중'},...research])
    if(resource==='watchlist'){
      if(watch.some(r=>r.market===row.market&&r.ticker===row.ticker))return '이미 Watchlist에 등록된 종목입니다.'
      updateWatch([{...common,priority:'B'},...watch])
    }
    if(resource==='portfolio'){
      if(portfolio.some(r=>r.market===row.market&&r.ticker===row.ticker))return '이미 Portfolio에 등록된 종목입니다.'
      updatePortfolio([{...common,shares:0,currency:row.market==='KR'?'KRW':'USD'},...portfolio])
    }
    if(resource==='journal')updateJournal([{...common,date:new Date().toISOString().slice(0,10),currency:row.market==='KR'?'KRW':'USD',status:'보유중'},...journal])
    return null
  }
  const addSelectedAnalysis=()=>{if(selected)recordAnalysis(selected)}
  const confirmDeleteAnalysis=()=>{
    if(!analysisDeleteTarget)return
    const target=analysisDeleteTarget
    const targetIndex=Math.max(0,Number(target.no||1)-1)
    const next=analysis.filter((r,i)=>target.id?r.id!==target.id:i!==targetIndex)
    updateAnalysis(next)
    setAnalysisDeleteTarget(null)
  }

  let content
  if(page==='dashboard'){
    content=<>{filters}
      <section className="dashboard-section leadership-overview">
        <div className="dashboard-section-head">
          <div><h2>주도 종목</h2><p>시장의 리더십 흐름을 한눈에 확인하세요.</p></div>
          <button className="dashboard-section-action" onClick={()=>{setDrillStock(null);setSummaryTab(null);setDrillSectorKey('ALL')}}>전체 보기 →</button>
        </div>
        <div className="leadership-card-grid">
          <LeadershipCard tone="green" icon="♛" label="핵심 주도" value={leadCount} sub="시장 상승을 이끄는 핵심 주도 종목" onClick={()=>showStockGroup('core')}/>
          <LeadershipCard tone="blue" icon="▥" label="주도 후보" value={candidateCount} sub="추가 상승이 기대되는 후보군" onClick={()=>showStockGroup('candidates')}/>
          <LeadershipCard tone="amber" icon="ϟ" label="강세 전환" value={turnCount} sub="추세 전환 신호가 포착된 종목" onClick={()=>showStockGroup('turns')}/>
          <LeadershipCard tone="violet" icon="∿" label="조정 중" value={correctionCount} sub="단기 조정이 진행 중인 종목" onClick={()=>showStockGroup('corrections')}/>
        </div>
      </section>

      <section className="dashboard-section market-internals">
        <div className="dashboard-section-head">
          <div><h2>시장 내부 지표</h2><p className="market-context" title={metricContext}>{metricContext}</p></div>
          <button className="dashboard-section-action" onClick={()=>setPage('leaderboard')}>지표 자세히 보기 →</button>
        </div>
        <div className="market-metric-grid">
          <MarketMetricCard tone="green" icon="↗" label="MA50 위 비율" value={(breadth*100).toFixed(0)+'%'} sub={'/ '+ma50Rows.length+' 종목'} progress={breadth*100}/>
          <MarketMetricCard tone="blue" icon="⌁" label="MA200 위 비율" value={(ma200Breadth*100).toFixed(0)+'%'} sub={'/ '+ma200Rows.length+' 종목'} progress={ma200Breadth*100}/>
          <MarketMetricCard tone="violet" icon="☆" label="52W 고점 근접" value={high52Rows.length?(highNearShare*100).toFixed(0)+'%':'—'} sub={highNearCount+' / '+high52Rows.length+' 종목 · 고점 -10% 이내'} progress={highNearShare*100}/>
          <MarketMetricCard tone="split" icon="↕" label="상승 / 하락 비율" value={(advanceDeclineRatio||0).toFixed(1)+' : 1'} sub={'1W 기준 · 상승 '+advanceCount+' · 하락 '+declineCount} progress={advanceCount+declineCount?advanceCount/(advanceCount+declineCount)*100:0}/>
          <MarketMetricCard tone="teal" icon="◴" label="평균 RS" value={averageRs==null?'—':averageRs.toFixed(1)} sub={'RS 데이터 '+stockRows.filter(r=>r.rs_rank!=null).length+' 종목'} progress={averageRs??0}/>
        </div>
      </section>

      <section className="sector-strip panel compact-panel dashboard-sector-filter">
        <div className="panel-head"><div><h2>섹터 필터</h2><p>시장과 섹터를 선택해 주도 종목을 좁혀보세요.</p></div></div>
        <div className="chips"><button className={!sector?'chip on':'chip'} onClick={()=>{setSector(null);setSectorKeySelected(null);setDrillSectorKey(null)}}>전체 섹터</button>{sectorOptions.map(g=><button key={g.key} className={sector===g.key?'chip on':'chip'} onClick={()=>{setSector(sector===g.key?null:g.key);setSectorKeySelected(null);setDrillSectorKey(null)}}>{sectorLabel(g)}</button>)}</div>
      </section>

      <section className="dashboard-lower-grid dashboard-sector-only">
        <div className="dashboard-left-column">
        <div className="panel industry-panel dashboard-sector-panel">
          <div className="panel-head dashboard-sector-head">
            <div><h2>섹터 요약</h2><p>RS 순위 기준 Top 5 · 섹터별 리더십과 52W 고점 근접도</p></div>
            <div className="sector-actions">
              <button className="dashboard-section-action" onClick={()=>setSectorSummaryOpen(true)}>전체 보기 →</button>
            </div>
          </div>
          <div className="industry-table-wrap dashboard-sector-table-wrap" style={sectorTableStyle}><table className="industry-table dashboard-sector-table sector-metrics-table"><thead><tr><th className="sector-name-head">섹터<button type="button" className="sector-column-resizer" aria-label="섹터 열 너비 조절" title="드래그하여 섹터 열 너비 조절" onPointerDown={startSectorColumnResize}/></th><th>RS 순위</th><th>종목 수</th><th>핵심 주도</th><th>주도 후보</th><th>강세 전환</th><th>조정 중</th><th>등락 5D</th><th>등락 20D</th><th>등락 50D</th><th>등락 120D</th><th>등락 200D</th><th>등락 52W</th><th>52W 고점 근접</th></tr></thead><tbody>
            {dashboardTopSectors.map(g=><tr key={g.key} className={sectorKeySelected===g.key?'selected':''} tabIndex={0} role="button" aria-label={`${sectorLabel(g)} 주도 종목 보기`} onClick={()=>{setSectorKeySelected(g.key);setSummaryTab(null);setDrillStock(null);setDrillSectorKey(compactStockLayout()?g.key:null)}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.currentTarget.click()}}}>
              <td className="industry-name-cell" title={sectorLabel(g)}><b>{sectorLabel(g)}</b><small>{g.verdict}</small></td>
              <td><span className={(g.medRank??0)>=90?'heat top':(g.medRank??0)>=70?'heat high':'heat'}>{g.medRank==null?'—':Math.round(g.medRank)}</span></td>
              <td>{g.n}</td>
              <td><strong className="sector-count sector-core-count">{g.core}</strong></td>
              <td><strong className="sector-count candidate">{g.candidate}</strong></td>
              <td><strong className="sector-count turn">{g.turn}</strong></td>
              <td><strong className="sector-count correction">{g.correction}</strong></td>
              {[g.medRet5d,g.medRet20d,g.medRet50d,g.medRet120d,g.medRet200d,g.medRet12m].map((value,i)=><td key={i} className={value!=null&&value>0?'pos':value!=null&&value<0?'neg':''}>{pct(value)}</td>)}
              <td><span className="sector-high-cell"><i><em style={{width:(g.highNearShare*100).toFixed(0)+'%'}}/></i><b>{(g.highNearShare*100).toFixed(0)}%</b></span></td>
            </tr>)}
            {!dashboardTopSectors.length&&<tr><td colSpan={14} className="empty">조건에 맞는 섹터가 없습니다.</td></tr>}
          </tbody></table></div>
        </div>
        <div className="panel dashboard-etf-industry-panel">
          <div className="panel-head dashboard-sector-head">
            <div><h2>ETF 주도 산업</h2><p title={ETF_INDUSTRY_VERSION}>타일 크기 = ETF 20일 평균 거래대금 · 색 = 기간별 RS 중앙값(벤치마크 대비) · 타일을 누르면 해당 ETF를 봅니다</p></div>
          </div>
          <div className="mini-segment etf-heat-periods" role="group" aria-label="RS 기간">{ETF_HEAT_PERIODS.map(([period])=><button key={period} type="button" className={etfHeatPeriod===period?'on':''} aria-pressed={etfHeatPeriod===period} onClick={()=>setEtfHeatPeriod(period)}>{period}</button>)}</div>
          <EtfIndustryHeatmap groups={etfIndustries} markets={market==='ALL'?['KR','US']:[market]} period={etfHeatPeriod} onSelect={openEtfIndustry}/>
        </div>
        </div>
        <div className="panel dashboard-stock-panel">
          <div className="panel-head dashboard-sector-head"><div><h2>주도 종목</h2><p>{chosenSector?sectorLabel(chosenSector):'전체 섹터'} · RS 순위 기준 Top 12</p></div><button className="dashboard-section-action" onClick={()=>{setDrillStock(null);setSummaryTab(null);setDrillSectorKey(chosenSector?.key||sector||'ALL')}}>전체 보기 →</button></div>
          <div className="dashboard-leader-tabs" role="group" aria-label="주도 종목 분류">
            {(['core','candidates','turns','corrections'] as const).map(tab=><button key={tab} className={stockTab===tab?'on':''} onClick={()=>setStockTab(tab)}>{({core:'핵심 주도',candidates:'주도 후보',turns:'강세 전환',corrections:'조정 중'} as const)[tab]} <b>{stockGroups[tab].length}</b></button>)}
          </div>
          <StockRows rows={tabStocks.slice(0,12)} onSelect={row=>{setSelected(row);setSummaryTab(null);setDrillSectorKey(null);setDrillStock(row)}}/>
        </div>
      </section>

      <section className="panel dashboard-etf-panel">
        <div className="panel-head dashboard-sector-head">
          <div><h2>ETF 요약</h2><p>ETF 전용 RS 순위 기준 Top 5 · 주식 순위와 별도 산정</p></div>
          <div className="sector-actions"><button className="dashboard-section-action" onClick={()=>setEtfSummaryOpen(true)}>전체 보기 →</button></div>
        </div>
        <StockRows label="ETF" rows={rankedEtfRows.slice(0,5)} onSelect={openEtf} nameWidth={sectorNameWidth} onResizeStart={startSectorColumnResize}/>
      </section>
    </>
  }else if(page==='leaderboard'){
    content=<><div className="page-note"><b>읽는 순서</b><span>섹터 → 주도 분류 → 모멘텀 단계 → RS → 액션 가이드</span></div>{filters}<div className="panel"><GridTable rows={visible} columns={leaderCols} height={680}/></div></>
  }else if(page==='watchlist'){
    content=<><div className="page-note"><b>Watchlist</b><span>종목코드를 입력하면 현재가·산업·섹터·단계·RS가 자동 연결됩니다. 관심가·손절·우선순위를 관리하세요.</span></div><TickerEntry onAdd={ticker=>addTickerRecord('watchlist',ticker)}/><div className="panel"><LiveGridTable rows={enrich(watch)} columns={watchCols} editable onChange={updateWatch} height={650}/></div></>
  }else if(page==='portfolio'){
    content=<><div className="page-note"><b>Portfolio</b><span>종목코드를 입력하면 현재가·산업·섹터가 연결됩니다. 수량·평단·Stop·투자 가설을 관리하세요.</span></div><TickerEntry onAdd={ticker=>addTickerRecord('portfolio',ticker)}/><div className="panel"><LiveGridTable rows={enrich(portfolio)} columns={portfolioCols} editable onChange={updatePortfolio} height={650}/></div></>
  }else if(page==='analysis'){
    content=<><div className="analysis-layout"><div className="panel stock-list"><div className="panel-head"><div><h2>종목 선택</h2><p>산업·RS가 강한 순</p></div></div>{visible.slice().sort((a,b)=>(b.rs_rank??0)-(a.rs_rank??0)).map(r=><button key={r.id} className={selected?.id===r.id?'on':''} onClick={()=>setSelected(r)}><b>{r.ticker}</b><span>{r.name}</span><em>{r.industry} · {stageLabel(r.stage)}</em></button>)}</div>
      <div className="panel analysis-card">{selected?<><div className="stock-title"><div><span>{selected.market} · <b>{selected.industry}</b> · {selected.sector}</span><h2>{selected.name} <small>{selected.ticker}</small></h2></div><div><ValuePill tone={leadTone(leadership(selected))}>{leadership(selected)||'관찰'}</ValuePill></div></div>
        <StockSnapshot row={selected} onRefresh={()=>void refreshLeaderboard()} refreshing={refreshing}/>
        <div className="checklist"><h3>리더보드 자동 체크</h3><label><span>Trend Template</span><b>{selected.leader_tt?'PASS':'CHECK'}</b></label><label><span>Price &gt; MA50 &gt; MA200</span><b>{selected.price&&selected.ma50&&selected.ma200&&selected.price>selected.ma50&&selected.ma50>selected.ma200?'PASS':'CHECK'}</b></label><label><span>RS순위 ≥ 70</span><b>{((selected.asset_class==='ETF'?selected.etf_rs_rank:selected.rs_rank)??0)>=70?'PASS':'CHECK'}</b></label><label><span>52주 고점 -25% 이내</span><b>{(selected.high_52w_distance??-1)>=-.25?'PASS':'CHECK'}</b></label></div>
        <div className="action-box"><span>액션 가이드</span><strong>{selected.action_guide}</strong></div><button className="primary-action" onClick={addSelectedAnalysis}>이 종목 분석행 추가</button>
      </>:<p>종목을 선택하세요.</p>}</div></div>
      <div ref={analysisRecordsRef} className="records-anchor"><div className="page-note"><b>종목분석 기록</b><span>종목코드를 입력하면 현재가·산업·섹터·모멘텀·RS가 연결됩니다. 재무 및 질적 분석은 직접 입력하세요.</span></div><TickerEntry onAdd={ticker=>addTickerRecord('analysis',ticker)}/><div className="panel"><GridTable rows={enrichedAnalysis} columns={analysisTableCols} editable onChange={updateAnalysis} height={560}/></div></div></>
  }else if(page==='research'){
    content=<><div className="page-note"><b>Research Notes</b><span>종목코드를 입력하면 종목명·현재가·산업·섹터·단계·RS가 연결됩니다. 팩트 → 해석 → 영향 → 다음 확인 순서로 기록하세요.</span></div><TickerEntry onAdd={ticker=>addTickerRecord('research',ticker)}/><div className="panel"><GridTable rows={enrichedResearch} columns={researchCols} editable onChange={updateResearch} height={680}/></div></>
  }else if(page==='journal'){
    content=<><div className="page-note"><b>Trading Journal</b><span>종목코드를 입력하면 종목명·현재가·산업·섹터·RS가 연결됩니다. 매수 가설과 결과 복기를 기록하세요.</span></div><TickerEntry onAdd={ticker=>addTickerRecord('journal',ticker)}/><div className="panel"><GridTable rows={enrichedJournal} columns={journalCols} editable onChange={updateJournal} height={680}/></div></>
  }else if(page==='universe'){
    const cols:ColDef<LeaderRow>[]=[{field:'market',headerName:'시장',width:75,flex:0},{field:'ticker',headerName:'Ticker',pinned:'left',width:100,flex:0},{field:'name',headerName:'종목명',pinned:'left',minWidth:160},{field:'exchange',headerName:'거래소',minWidth:100},{field:'sector',headerName:'섹터',minWidth:170},{field:'industry',headerName:'산업',minWidth:190},{field:'index_memberships',headerName:'지수 · 유니버스',minWidth:210,valueFormatter:p=>Array.isArray(p.value)?p.value.join(' · '):'—'},{field:'index_statuses',headerName:'구성 상태',minWidth:155,valueFormatter:p=>Array.isArray(p.value)?p.value.join(' · '):'—'},{field:'data_status',headerName:'시장 데이터',minWidth:110},{field:'classification_scheme',headerName:'분류 체계',minWidth:210},{field:'classification_as_of',headerName:'분류 기준일',minWidth:115}]
    content=<><div className="page-note"><b>Universe</b><span>S&P500 · NASDAQ · KOSPI200 · KOSDAQ150 구성과 분류 출처를 자동 동기화합니다.</span></div>{filters}<div className="panel"><GridTable rows={visible.filter(r=>r.asset_class==='Equity')} columns={cols} height={650}/></div></>
  }else{
    content=<div className="settings-grid"><div className="panel"><h2>주도력 선별 기준</h2><div className="setting"><span>추세 통과 · 간소화 필터</span><b>종가 &gt; 50일선 &gt; 200일선 · 52주 고점 -25% 이내 · RS순위 ≥70</b></div><div className="setting"><span>주도 후보</span><b>추세 통과 · IBD식 RS(추정) ≥{CANDIDATE_RS_MIN} · 52주 고점 {CANDIDATE_HIGH_DISTANCE_MIN*100}% 이내 · RS 3M &gt; 0</b></div><div className="setting"><span>핵심 주도 · Peppercorn 강화 기준</span><b>RS순위 ≥95 · 52주 고점 -15% 이내 · RS 3M/6M &gt; 0</b></div><div className="setting"><span>조정 중 · 별도 관찰</span><b>후보에 자동 포함하지 않음</b></div><div className="setting"><span>강세 전환 · 자체 발굴 기준</span><b>52주 고점 -30% 이내 · RS 개선</b></div><div className="setting"><span>돌파 거래량 참고</span><b>20일 평균 대비 ≥1.4배</b></div><div className="setting"><span>52W 계산</span><b>52W 고점: 최근 최대 252개 거래 세션의 최고가(이력 부족 시 확보된 기간) · RS/등락 52W: 252거래일 전 종가 대비</b></div><div className="criteria-sources"><p>출처와 적용 범위: 미너비니의 Trend Template는 52주 고점 -25% 이내·RS 70 이상을 포함합니다. IBD는 초기 주도주의 RS Rating 80 이상을 중시합니다. IBD식 RS(추정)는 최근 12개월을 63거래일씩 나눠 최신 분기 40%, 이전 분기 각 20%의 수익률로 계산하고, KR·US 시장의 수집 종목을 각각 1~99 백분위로 변환합니다. 주식 가격 이력 253거래일 미만은 공란입니다. ETF는 주식 순위와 섞지 않고 같은 시장 ETF끼리 따로 RS순위·IBD식 RS를 산정하며, 같은 Trend Template·단계·최종 판단·액션 가이드 규칙을 적용합니다(주도 분류는 주식 전용). 공식 IBD Rating은 독점적인 별도 종목군을 사용하므로 일치하지 않습니다. 기존 RS순위는 벤치마크 대비 자체 점수입니다. 150일선, 200일선 상승 여부 등 전체 Trend Template도 아직 계산하지 않습니다. 종목 분류는 매수 신호가 아닙니다.</p><a href="https://books.google.com/books/about/Trade_Like_a_Stock_Market_Wizard_How_to.html?id=i5ZdR7mekpEC" target="_blank" rel="noreferrer">Mark Minervini · Trade Like a Stock Market Wizard ↗</a><a href="https://www.williamoneil.com/about-us/legal/oneil-proprietary-rating-and-rankings" target="_blank" rel="noreferrer">William O’Neil + Co. · RS Rating 계산 설명 ↗</a><a href="https://www.investors.com/news/beigene-stock-meets-80-plus-rs-rating-benchmark/" target="_blank" rel="noreferrer">Investor’s Business Daily · RS Rating 80 ↗</a></div></div>
      <div className="panel"><h2>Account & Storage</h2><p className="note">{session?'로그인됨 · Watchlist / Portfolio / Research / Analysis / Journal은 Supabase에 저장됩니다.':'로그인하지 않은 편집 내용은 이 기기의 브라우저에만 저장됩니다.'}</p><div className="setting"><span>Market Data</span><b>Supabase Live</b></div><div className="setting"><span>Personal Data</span><b>{session?'Cloud + RLS':'Local only'}</b></div><button className="settings-auth" onClick={()=>session?updateSession(null):setAuthOpen(true)}>{session?'로그아웃':'로그인 / 최초 등록'}</button></div></div>
  }

  const pageTitle:Record<string,string>={dashboard:'Dashboard',leaderboard:'Leaderboard',watchlist:'Watchlist',portfolio:'Portfolio',analysis:'종목 분석',research:'Research Notes',journal:'Trading Journal',universe:'Universe',settings:'Settings'}
  const closeDrill=()=>{setDrillStock(null);setDrillSectorKey(null);setSummaryTab(null)}
  const sectorSummaryDialog=<Dialog open={sectorSummaryOpen} onOpenChange={setSectorSummaryOpen}>
    <DialogContent className="sector-summary-dialog">
      <div className="drill-handle"/>
      <div className="sector-summary-dialog-head">
        <div><small>{market==='ALL'?'전체 시장':market}</small><DialogTitle>섹터 요약 · 전체</DialogTitle><DialogDescription>RS 순위 중앙값 기준 내림차순 · 주도 분류와 등락 5D~52W 전체 보기</DialogDescription></div>
        <DialogClose asChild><button className="drill-close" aria-label="닫기">×</button></DialogClose>
      </div>
      <div className="sector-summary-dialog-table" style={sectorTableStyle}><table className="industry-table dashboard-sector-table sector-summary-full-table sector-metrics-table"><thead><tr><th className="sector-name-head">섹터<button type="button" className="sector-column-resizer" aria-label="섹터 열 너비 조절" title="드래그하여 섹터 열 너비 조절" onPointerDown={startSectorColumnResize}/></th><th>RS 순위</th><th>종목 수</th><th>핵심 주도</th><th>주도 후보</th><th>강세 전환</th><th>조정 중</th><th>등락 5D</th><th>등락 20D</th><th>등락 50D</th><th>등락 120D</th><th>등락 200D</th><th>등락 52W</th><th>52W 고점 근접</th></tr></thead><tbody>
        {rankedSectorRows.map(g=><tr key={g.key} tabIndex={0} role="button" aria-label={`${sectorLabel(g)} 상세 보기`} onClick={()=>{setSectorSummaryOpen(false);setSectorKeySelected(g.key);setSummaryTab(null);setDrillStock(null);setDrillSectorKey(compactStockLayout()?g.key:null)}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.currentTarget.click()}}}>
          <td className="industry-name-cell" title={sectorLabel(g)}><b>{sectorLabel(g)}</b><small>{g.verdict}</small></td>
          <td><span className={(g.medRank??0)>=90?'heat top':(g.medRank??0)>=70?'heat high':'heat'}>{g.medRank==null?'—':Math.round(g.medRank)}</span></td>
          <td>{g.n}</td>
          <td><strong className="sector-count sector-core-count">{g.core}</strong></td>
          <td><strong className="sector-count candidate">{g.candidate}</strong></td>
          <td><strong className="sector-count turn">{g.turn}</strong></td>
          <td><strong className="sector-count correction">{g.correction}</strong></td>
          {[g.medRet5d,g.medRet20d,g.medRet50d,g.medRet120d,g.medRet200d,g.medRet12m].map((value,i)=><td key={i} className={value!=null&&value>0?'pos':value!=null&&value<0?'neg':''}>{pct(value)}</td>)}
          <td><span className="sector-high-cell"><i><em style={{width:(g.highNearShare*100).toFixed(0)+'%'}}/></i><b>{(g.highNearShare*100).toFixed(0)}%</b></span></td>
        </tr>)}
        {!rankedSectorRows.length&&<tr><td colSpan={14} className="empty">조건에 맞는 섹터가 없습니다.</td></tr>}
      </tbody></table></div>
    </DialogContent>
  </Dialog>
  const etfSummaryDialog=<Dialog open={etfSummaryOpen} onOpenChange={open=>{setEtfSummaryOpen(open);if(!open)setEtfIndustryKey(null)}}>
    <DialogContent className="sector-summary-dialog etf-summary-dialog">
      <div className="drill-handle"/>
      <div className="sector-summary-dialog-head">
        <div><small>{market==='ALL'?'전체 시장':market}</small><DialogTitle>{chosenEtfIndustry?`ETF 주도 산업 · ${etfIndustryLabel(chosenEtfIndustry.market,chosenEtfIndustry.industry)}`:'ETF 요약 · 전체'}</DialogTitle><DialogDescription>ETF 전용 RS 순위 내림차순 · 시장별로 ETF끼리만 비교 · 주도 종목과 같은 항목</DialogDescription></div>
        <DialogClose asChild><button className="drill-close" aria-label="닫기">×</button></DialogClose>
      </div>
      <div className="drill-summary-list"><StockRows label="ETF" rows={dialogEtfRows} onSelect={openEtf} nameWidth={sectorNameWidth} onResizeStart={startSectorColumnResize}/></div>
    </DialogContent>
  </Dialog>
  const drillOverlay=<Dialog open={drillOpen} onOpenChange={open=>{if(!open)closeDrill()}}>
    <DialogContent ref={drillRef} className="drill-sheet">
      <div className="drill-handle"/>
      <div className="drill-head">
        <div><small>{summaryTab?(market==='ALL'?'전체 시장':market):drillStock?sectorName(drillStock.market,drillStock.sector):(drillSector?.market||'전체 시장')}</small><DialogTitle>{drillStock?drillStock.name:summaryTab?`주도 종목 · ${{core:'핵심 주도',candidates:'주도 후보',turns:'강세 전환',corrections:'조정 중'}[summaryTab]}`:(drillSector?sectorName(drillSector.market,drillSector.sector):'전체 주도 종목')}</DialogTitle><DialogDescription className="sr-only">분류별 주도 종목과 상세 리더십 지표</DialogDescription></div>
        <DialogClose asChild><button className="drill-close" aria-label="닫기">×</button></DialogClose>
      </div>
      {drillStock?<div className="drill-stock-detail drill-content">
        <div className="drill-meta drill-animate"><ValuePill tone={leadTone(leadership(drillStock))}>{leadership(drillStock)||'관찰'}</ValuePill><ValuePill tone={stageTone(drillStock.stage)}>{stageLabel(drillStock.stage)}</ValuePill><span>{drillStock.market} · {drillStock.ticker}</span></div>
        <StockSnapshot row={drillStock} onRefresh={()=>void refreshLeaderboard()} refreshing={refreshing}/>
        <div className="drill-guide drill-animate"><span>액션 가이드</span><strong>{drillStock.action_guide}</strong></div>
        <div className="drill-checks drill-animate"><span>Trend Template</span><b>{drillStock.leader_tt?'PASS':'CHECK'}</b><span>추세</span><b>{drillStock.price&&drillStock.ma50&&drillStock.ma200&&drillStock.price>drillStock.ma50&&drillStock.ma50>drillStock.ma200?'Price > MA50 > MA200':'확인 필요'}</b></div>
        <button className="primary-action" onClick={()=>recordAnalysis(drillStock,true)}>종목분석 기록 작성 →</button>
      </div>:summaryTab?<div className="drill-content drill-summary-list">
        <p className="drill-note">{market==='ALL'?'전체 시장':market} · {summaryGroups[summaryTab].length}종목 · RS순위 높은 순</p>
        <StockRows rows={summaryGroups[summaryTab].slice().sort((a,b)=>(b.rs_rank??0)-(a.rs_rank??0))} onSelect={r=>{setSelected(r);setDrillStock(r)}}/>
      </div>:<div className="drill-industry-detail drill-content">
        {drillSector&&<div className="drill-summary"><Kpi label="판정" value={drillSector.verdict}/><Kpi label="종목 수" value={drillSector.n}/><Kpi label="핵심 주도 비율" value={pct(drillSector.coreShare)}/><Kpi label="MA50 위" value={pct(drillSector.breadth)}/><Kpi label="RS순위 중앙값" value={drillSector.medRank==null?'—':Math.round(drillSector.medRank)}/><Kpi label="RS 3M" value={pct(drillSector.medRs3m)}/></div>}
        {drillSector?.smallSample&&<p className="sample-explainer">소표본 섹터입니다. 종목 수를 별도 표시하고 더 엄격한 판정 기준을 적용합니다.</p>}
        <div className="tabs drill-tabs"><button className={stockTab==='core'?'on':''} onClick={()=>setStockTab('core')}>핵심 주도 <b>{drillStockGroups.core.length}</b></button><button className={stockTab==='candidates'?'on':''} onClick={()=>setStockTab('candidates')}>주도 후보 <b>{drillStockGroups.candidates.length}</b></button><button className={stockTab==='turns'?'on':''} onClick={()=>setStockTab('turns')}>강세 전환 <b>{drillStockGroups.turns.length}</b></button><button className={stockTab==='corrections'?'on':''} onClick={()=>setStockTab('corrections')}>조정 중 <b>{drillStockGroups.corrections.length}</b></button></div>
        <p className="drill-note">종목을 누르면 상세 지표를 확인합니다.</p>
        <StockRows rows={drillStockGroups[stockTab]} onSelect={r=>{setSelected(r);setDrillStock(r)}}/>
      </div>}
    </DialogContent>
  </Dialog>
  const deleteDialog=<AlertDialog open={!!analysisDeleteTarget} onOpenChange={open=>{if(!open)setAnalysisDeleteTarget(null)}}>
    <AlertDialogContent>
      <AlertDialogTitle>종목분석 기록을 삭제할까요?</AlertDialogTitle>
      <AlertDialogDescription>{analysisDeleteTarget?String(analysisDeleteTarget.name||analysisDeleteTarget.ticker||'선택한 기록'):''} 기록이 종목분석에서 삭제됩니다. 로그인 상태에서는 Supabase에도 동기화됩니다.</AlertDialogDescription>
      <div className="ui-alert-actions"><AlertDialogCancel>취소</AlertDialogCancel><AlertDialogAction onClick={confirmDeleteAnalysis}>삭제</AlertDialogAction></div>
    </AlertDialogContent>
  </AlertDialog>
  return <LiveQuoteProvider enabled={source==='supabase'}><div className="shell"><Sidebar page={page} setPage={setPage} open={menuOpen} setOpen={setMenuOpen}/><main><header className="topbar"><button className="topbar-menu" onClick={()=>setMenuOpen(true)} aria-label="전체 메뉴 열기" aria-haspopup="dialog" aria-expanded={menuOpen}>☰</button><div className="topbar-title"><h1>{pageTitle[page]||page}</h1><p>Sector → Stock · Leadership & Risk Workspace</p></div><div className="top-actions"><button className={'source '+source} aria-label="시장 데이터 새로고침" title={source==='demo'?'데모 데이터 · 라이브 연결 다시 시도':'시장 데이터 새로고침'} disabled={refreshing} onClick={()=>void refreshLeaderboard()}>{source==='supabase'?'● Supabase Live':'○ Demo / Local'} <span aria-hidden="true">↻</span></button><span className={'sync-state '+syncState}>{session?(syncState==='saving'?'☁ 저장 중':syncState==='loading'?'☁ 불러오는 중':syncState==='error'?'☁ 동기화 오류':'☁ 저장됨'):'기기 저장'}</span><InstallApp/><button onClick={()=>session?updateSession(null):setAuthOpen(true)}>{session?'로그아웃':'로그인'}</button><button onClick={()=>setPage('settings')}>환경 설정</button></div></header><div className="content">{content}</div><AuthModal open={authOpen} onClose={()=>setAuthOpen(false)} onAuthenticated={updateSession}/></main>{sectorSummaryDialog}{etfSummaryDialog}{drillOverlay}{deleteDialog}</div>{showIntro&&<div ref={launchRef} className="launch-overlay" role="status" aria-label="Folio 시작 화면"><div className="launch-screen"><div className="launch-center"><div className="launch-brand"><img className="launch-emblem" src="./folio-icon.webp" alt=""/><img className="launch-wordmark" src="./folio-wordmark.webp" alt="Folio"/></div><p className="launch-slogan">Fewer decisions. Greater conviction</p><p className="launch-description">모멘텀·성장주·가치투자 전략을 통합해 시장 주도주 발굴, 기업 펀더멘털 및 내재가치 분석, 투자 기회 평가부터 포트폴리오 관리까지 체계적으로 지원하는 데이터 기반 투자 분석 플랫폼</p><div className="launch-progress" aria-label="화면 준비 중"><span/></div></div><footer className="launch-footer"><img src="./logo.webp" alt=""/><span>Peppercorn Capital</span><small>© {new Date().getFullYear()} All rights reserved.</small></footer></div></div>}</LiveQuoteProvider>
}
