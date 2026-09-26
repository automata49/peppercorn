import { useEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import type { ColDef } from 'ag-grid-community'
import { Sidebar } from './components/Sidebar'
import { GridTable } from './components/GridTable'
import { AuthModal } from './components/AuthModal'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from './components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from './components/ui/alert-dialog'
import { initialAnalysis, initialJournal, initialPortfolio, initialResearch, initialWatchlist } from './data/mock'
import { loadLeaderboard } from './lib/rest'
import { loadStoredSession, loadWorkspace, saveWorkspace, storeSession, type Session, type WorkspaceResource } from './lib/session'
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
const SHEET_URL='https://docs.google.com/spreadsheets/d/1KdbQqmGP7Q0iVV76OmJg1wpP9pB5vrni5SrjAMrbbiE/edit'
const tradingViewUrl=(r:LeaderRow)=>'https://www.tradingview.com/chart/?symbol='+encodeURIComponent(r.market==='KR'?'KRX:'+r.ticker:r.ticker)
const saveTickerUrl=(r:LeaderRow)=>'https://www.saveticker.com/company/'+encodeURIComponent(r.ticker)+'?entry=search_result'
const med=(values:unknown[])=>{
  const a=values.filter(v=>v!=null&&v!=='').map(Number).filter(Number.isFinite).sort((x,y)=>x-y)
  if(!a.length) return null
  const m=Math.floor(a.length/2)
  return a.length%2?a[m]:(a[m-1]+a[m])/2
}
const leadership=(r:LeaderRow)=>{
  if(r.leadership_class)return r.leadership_class
  if(r.leader_tt&&(r.rs_rank??0)>=95&&(r.high_52w_distance??-1)>=-.15&&(r.rs_3m??-1)>0&&(r.rs_6m??-1)>0)return '핵심 주도'
  if((r.leader_tt&&(r.rs_rank??0)>=85&&(r.high_52w_distance??-1)>=-.20&&(r.rs_3m??-1)>0)||(isCorrection(r)&&(r.rs_rank??0)>=85))return '주도 후보'
  if(String(r.stage).includes('넥스트 리더'))return '강세 전환'
  if(String(r.stage).startsWith('❌'))return '약세'
  return '중립'
}
const isCorrection=(r:LeaderRow)=>String(r.stage||'').includes('조정 중')
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
  medRs5d:number|null;medRs20d:number|null;medRs50d:number|null;
  medRet5d:number|null;medRet20d:number|null;medRet50d:number|null;
  verdict:string;smallSample:boolean;top:string[]
}

const sectorKey=(r:LeaderRow)=>`${r.market}|${r.sector||'분류 확인'}`
function buildSectors(rows:LeaderRow[]):SectorSummary[]{
  const groups=new Map<string,LeaderRow[]>()
  for(const r of rows){
    if(r.asset_class!=='Equity')continue
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
    const medRs5d=med(list.map(r=>r.rs_5d)),medRs20d=med(list.map(r=>r.rs_20d)),medRs50d=med(list.map(r=>r.rs_50d))
    const medRet5d=med(list.map(r=>r.return_5d)),medRet20d=med(list.map(r=>r.return_20d)),medRet50d=med(list.map(r=>r.return_50d))
    const smallSample=n<3
    const strongShare=n?(core+candidate)/n:0
    const improvingShare=n?(candidate+turn+correction)/n:0
    let verdict='중립'
    if(smallSample){
      if(core>0&&(medRank??0)>=90&&(medRs50d??-1)>0)verdict='강한 섹터'
      else if((candidate+turn)>0&&(medRank??0)>=70&&(medRs20d??-1)>0)verdict='개선 섹터'
      else if(breadth<.35&&(medRank??50)<40)verdict='약세'
    }else if(strongShare>=.25&&(medRank??0)>=75&&breadth>=.55&&(medRs50d??-1)>0)verdict='강한 섹터'
    else if(improvingShare>=.35&&(medRank??0)>=55&&breadth>=.45&&(medRs20d??-1)>0)verdict='개선 섹터'
    else if(breadth<.35&&(medRank??50)<45)verdict='약세'
    const ranked=list.slice().sort((a,b)=>(b.rs_rank??0)-(a.rs_rank??0)).slice(0,3).map(r=>r.name)
    return {key,market:list[0].market,sector:list[0].sector||'분류 확인',n,core,candidate,turn,correction,coreShare,breadth,medRank,medRs5d,medRs20d,medRs50d,medRet5d,medRet20d,medRet50d,verdict,smallSample,top:ranked}
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
  {field:'stage',headerName:'모멘텀 단계',minWidth:150,cellClassRules:stageRules},
  {field:'verdict',headerName:'최종 판단',minWidth:135},
  {field:'price',headerName:'현재가',valueFormatter:p=>num(p.value)},
  {field:'rs_rank',headerName:'RS순위',cellClassRules:{'rank-high':p=>Number(p.value)>=70,'rank-top':p=>Number(p.value)>=90}},
  {field:'rs_5d',headerName:'RS 5D',valueFormatter:p=>pct(p.value),cellClassRules:upDownRules},
  {field:'rs_20d',headerName:'RS 20D',valueFormatter:p=>pct(p.value),cellClassRules:upDownRules},
  {field:'rs_50d',headerName:'RS 50D',valueFormatter:p=>pct(p.value),cellClassRules:upDownRules},
  {field:'rs_120d',headerName:'RS 120D',valueFormatter:p=>pct(p.value),cellClassRules:upDownRules},
  {field:'rs_200d',headerName:'RS 200D',valueFormatter:p=>pct(p.value),cellClassRules:upDownRules},
  {field:'return_5d',headerName:'등락 5D',valueFormatter:p=>pct(p.value),cellClassRules:upDownRules},
  {field:'return_20d',headerName:'등락 20D',valueFormatter:p=>pct(p.value),cellClassRules:upDownRules},
  {field:'return_50d',headerName:'등락 50D',valueFormatter:p=>pct(p.value),cellClassRules:upDownRules},
  {field:'return_120d',headerName:'등락 120D',valueFormatter:p=>pct(p.value),cellClassRules:upDownRules},
  {field:'return_200d',headerName:'등락 200D',valueFormatter:p=>pct(p.value),cellClassRules:upDownRules},
  {field:'high_52w_distance',headerName:'52W High',valueFormatter:p=>pct(p.value)},
  {field:'volume_ratio',headerName:'거래량 배수',valueFormatter:p=>p.value==null?'—':Number(p.value).toFixed(2)+'x'},
  {field:'rsi14',headerName:'RSI',valueFormatter:p=>p.value==null?'—':Number(p.value).toFixed(0)},
  {field:'atr_multiple',headerName:'ATR배수',valueFormatter:p=>p.value==null?'—':Number(p.value).toFixed(1)+'x'},
  {field:'action_guide',headerName:'액션 가이드',minWidth:280}
]

const watchCols:ColDef<EditableRow>[]=[
  {field:'market',headerName:'시장',editable:false,width:78,flex:0},{field:'ticker',headerName:'Ticker',editable:false,pinned:'left',width:95,flex:0},
  {field:'name',headerName:'종목명',editable:false,minWidth:140},{field:'industry',headerName:'산업',editable:false,minWidth:150},{field:'sector',headerName:'섹터',editable:false,minWidth:130},
  {field:'stage',headerName:'단계',editable:false,minWidth:145,cellClassRules:stageRules},{field:'rs_rank',headerName:'RS순위',editable:false},
  {field:'interest_price',headerName:'관심가'},{field:'stop_pct',headerName:'손절 %'},{field:'priority',headerName:'우선순위'},{field:'note',headerName:'메모',minWidth:260}
]
const portfolioCols:ColDef<EditableRow>[]=[
  {field:'market',headerName:'시장',width:78,flex:0},{field:'ticker',headerName:'Ticker',pinned:'left',width:95,flex:0},
  {field:'name',headerName:'종목명',minWidth:140},{field:'industry',headerName:'산업',editable:false,minWidth:150},{field:'sector',headerName:'섹터',editable:false,minWidth:130},
  {field:'account',headerName:'계좌'},{field:'shares',headerName:'수량'},{field:'avg_price',headerName:'평단'},{field:'current_price',headerName:'현재가'},
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
  {field:'sector',headerName:'섹터(자동)',editable:false,minWidth:135},{field:'industry',headerName:'산업(자동)',editable:false,minWidth:150},
  {field:'stage',headerName:'모멘텀 단계(자동)',editable:false,minWidth:150,cellClassRules:stageRules},{field:'verdict',headerName:'최종 판단(자동)',editable:false,minWidth:135},
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
  {field:'stage',headerName:'리더보드 단계(자동)',editable:false,minWidth:150,cellClassRules:stageRules},{field:'industry',headerName:'산업(자동)',editable:false,minWidth:150},
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
  {field:'stage',headerName:'리더보드 단계(자동)',editable:false,minWidth:150,cellClassRules:stageRules},{field:'market',headerName:'시장(자동)',editable:false,width:98,flex:0},
  {field:'sector',headerName:'섹터(자동)',editable:false,minWidth:135},{field:'industry',headerName:'산업(자동)',editable:false,minWidth:150},{field:'verdict',headerName:'최종 판단(자동)',editable:false,minWidth:135},
  {field:'rs_rank',headerName:'RS순위(자동)',editable:false,width:100,flex:0,cellClassRules:{'rank-high':p=>Number(p.value)>=70,'rank-top':p=>Number(p.value)>=90}},
  {field:'analysis_no',headerName:'종목분석 No(자동)',editable:false,width:125,flex:0},{field:'research_no',headerName:'리서치노트 No(자동)',editable:false,width:135,flex:0}
]

function Kpi({label,value,sub,onClick}:{label:string;value:string|number;sub?:string;onClick?:()=>void}){
  const content=<><span>{label}</span><strong>{value}</strong>{sub&&<small>{sub}</small>}</>
  return onClick?<button type="button" className="kpi kpi-action" onClick={onClick} aria-label={`${label} ${value}종목 보기`}>{content}</button>:<div className="kpi">{content}</div>
}

function ValuePill({children,tone='gray'}:{children:any;tone?:string}){return <span className={'pill '+tone}>{children}</span>}

function StockRows({rows,onSelect}:{rows:LeaderRow[];onSelect:(row:LeaderRow)=>void}){
  return <div className="stock-rows"><div className="stock-rows-head"><span>종목</span><span>현재가</span><span>단계</span><span>RS</span><span>RS 5D</span><span>RS 20D</span><span>RS 50D</span><span>등락 5D</span><span>등락 20D</span><span>등락 50D</span></div>{rows.map(r=><button key={r.id} className="stock-row" onClick={()=>onSelect(r)}>
    <div className="stock-id" title={`${r.name} · ${r.ticker}`}><b>{r.name}</b><small>{r.market} · {r.ticker} · {r.industry}</small></div><span className="stock-price">{num(r.price)}</span><ValuePill tone={stageTone(r.stage)}>{r.stage}</ValuePill><strong className={(r.rs_rank??0)>=90?'rank rank-top':(r.rs_rank??0)>=70?'rank rank-high':'rank'}>{r.rs_rank??'—'}</strong>
    {([r.rs_5d,r.rs_20d,r.rs_50d,r.return_5d,r.return_20d,r.return_50d] as const).map((value,i)=><span key={i} className={value!=null&&value>0?'pos':value!=null&&value<0?'neg':''}>{pct(value)}</span>)}
  </button>)}{!rows.length&&<div className="empty">선택한 범위에 해당 종목이 없습니다.</div>}</div>
}

function SnapshotItem({label,children,wide=false}:{label:string;children:any;wide?:boolean}){
  return <div className={'snapshot-item'+(wide?' wide':'')}><span>{label}</span><strong>{children}</strong></div>
}

function StockSnapshot({row}:{row:LeaderRow}){
  const ma200Gap=gapPct(row.price,row.ma200)
  const ma200Status=row.price!=null&&row.ma200!=null?(Number(row.price)>=Number(row.ma200)?'위 ':'아래 ')+ma200Gap:'—'
  const indexes=row.index_memberships?.length?row.index_memberships.join(' · '):'—'
  const rsItems=[['1W',row.rs_1w],['1M',row.rs_1m],['3M',row.rs_3m],['6M',row.rs_6m],['12M',row.rs_12m]] as const
  const retItems=[['1W',row.return_1w],['1M',row.return_1m],['3M',row.return_3m],['6M',row.return_6m],['12M',row.return_12m]] as const
  return <div className="stock-snapshot">
    <div className="external-links drill-animate">
      <a target="_blank" rel="noreferrer" href={tradingViewUrl(row)}>TradingView ↗</a>
      <a target="_blank" rel="noreferrer" href={saveTickerUrl(row)}>SaveTicker · {row.ticker} ↗</a>
      <a target="_blank" rel="noreferrer" href={SHEET_URL}>Google Sheet ↗</a>
    </div>
    <section className="snapshot-section leadership-section drill-animate">
      <div className="snapshot-section-head"><div><span>01</span><h3>리더십 · 분류</h3></div><ValuePill tone={leadTone(leadership(row))}>{leadership(row)}</ValuePill></div>
      <div className="leadership-hero">
        <div><span>RS순위</span><strong>{row.rs_rank??'—'}</strong></div>
        <div className="leadership-copy"><b>{row.verdict||'—'}</b><small>{row.stage||'—'}</small></div>
      </div>
      <p className="classification-summary">{row.market} · {sectorName(row.market,row.sector||'분류 확인')} · {row.industry||'분류 확인'} · {row.exchange||row.market}</p>
      <p className="classification-meta" title={row.classification_source||undefined}>지수 {indexes} · 데이터 {row.data_status||'정상'}{row.classification_as_of&&` · 분류 ${row.classification_as_of}`}{row.classification_source&&` · 출처 ${sourceName(row.classification_source)}`}</p>
    </section>
    <section className="snapshot-section drill-animate">
      <div className="snapshot-section-head"><div><span>02</span><h3>상대강도</h3></div><small>벤치마크 대비</small></div>
      <div className="signal-strip">{rsItems.map(([label,value])=><div key={label}><span>RS {label}</span><strong className={Number(value)>0?'pos':Number(value)<0?'neg':''}>{pct(value)}</strong></div>)}</div>
    </section>
    <section className="snapshot-section drill-animate">
      <div className="snapshot-section-head"><div><span>03</span><h3>가격 모멘텀</h3></div><small>기간 수익률</small></div>
      <div className="signal-strip">{retItems.map(([label,value])=><div key={label}><span>{label}</span><strong className={Number(value)>0?'pos':Number(value)<0?'neg':''}>{pct(value)}</strong></div>)}</div>
    </section>
    <section className="snapshot-section drill-animate">
      <div className="snapshot-section-head"><div><span>04</span><h3>추세 · 리스크</h3></div></div>
      <div className="snapshot-grid technical-grid">
        <SnapshotItem label="현재가">{num(row.price)}</SnapshotItem>
        <SnapshotItem label="MA50 이격">{gapPct(row.price,row.ma50)}</SnapshotItem>
        <SnapshotItem label="200일선">{ma200Status}</SnapshotItem>
        <SnapshotItem label="52주 고점 대비">{pct(row.high_52w_distance)}</SnapshotItem>
        <SnapshotItem label="거래량">{row.volume_ratio==null?'—':Number(row.volume_ratio).toFixed(2)+'x'}</SnapshotItem>
        <SnapshotItem label="RSI(14)">{row.rsi14==null?'—':Number(row.rsi14).toFixed(0)}</SnapshotItem>
        <SnapshotItem label="ATR배수">{row.atr_multiple==null?'—':Number(row.atr_multiple).toFixed(1)+'x'}</SnapshotItem>
        <SnapshotItem label="ADR20">{pct(row.adr20_pct)}</SnapshotItem>
      </div>
    </section>
  </div>
}

export default function App(){
  const [page,setPage]=useState('dashboard')
  const [leaders,setLeaders]=useState<LeaderRow[]>([])
  const [source,setSource]=useState<'demo'|'supabase'>('demo')
  const [market,setMarket]=useState<'ALL'|Market>('ALL')
  const [query,setQuery]=useState('')
  const [sector,setSector]=useState<string|null>(null)
  const [sectorKeySelected,setSectorKeySelected]=useState<string|null>(null)
  const [sectorMode,setSectorMode]=useState<'HOT'|'ALL'>('ALL')
  const [stockTab,setStockTab]=useState<'core'|'candidates'|'turns'|'corrections'>('core')
  const [summaryTab,setSummaryTab]=useState<'core'|'candidates'|'turns'|null>(null)
  const [selected,setSelected]=useState<LeaderRow|null>(null)
  const [drillSectorKey,setDrillSectorKey]=useState<string|null>(null)
  const [drillStock,setDrillStock]=useState<LeaderRow|null>(null)
  const [analysisDeleteTarget,setAnalysisDeleteTarget]=useState<EditableRow|null>(null)
  const drillRef=useRef<HTMLDivElement|null>(null)
  const [watch,setWatch]=useLocalRows<EditableRow>('peppercorn-watchlist',initialWatchlist)
  const [portfolio,setPortfolio]=useLocalRows<EditableRow>('peppercorn-portfolio',initialPortfolio)
  const [research,setResearch]=useLocalRows<EditableRow>('peppercorn-research',initialResearch)
  const [analysis,setAnalysis]=useLocalRows<EditableRow>('peppercorn-analysis',initialAnalysis)
  const [journal,setJournal]=useLocalRows<EditableRow>('peppercorn-journal',initialJournal)
  const [session,setSessionState]=useState<Session|null>(()=>loadStoredSession())
  const [authOpen,setAuthOpen]=useState(false)
  const [syncState,setSyncState]=useState<'local'|'loading'|'saving'|'saved'|'error'>(session?'loading':'local')
  const drillOpen=!!summaryTab||!!drillSectorKey||!!drillStock

  const updateSession=(next:Session|null)=>{setSessionState(next);storeSession(next);setSyncState(next?'saved':'local')}

  useEffect(()=>{loadLeaderboard().then(r=>{setLeaders(r.rows);setSource(r.source);setSelected(r.rows[0]??null)})},[])
  useEffect(()=>{setSector(null);setSectorKeySelected(null);setSummaryTab(null);setDrillSectorKey(null);setDrillStock(null)},[market])
  useEffect(()=>{
    if(!drillOpen||!drillRef.current||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return
    const root=drillRef.current
    const compact=window.matchMedia('(max-width: 1180px)').matches
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
  const summaryGroups={
    core:stockRows.filter(r=>leadership(r)==='핵심 주도'),
    candidates:stockRows.filter(r=>leadership(r)==='주도 후보'),
    turns:stockRows.filter(r=>leadership(r)==='강세 전환')
  }
  const leadCount=summaryGroups.core.length
  const candidateCount=summaryGroups.candidates.length
  const turnCount=summaryGroups.turns.length
  const breadth=stockRows.length?stockRows.filter(r=>r.price&&r.ma50&&r.price>r.ma50).length/stockRows.length:0

  const allSectorRows=useMemo(()=>buildSectors(marketRows),[marketRows])
  const eligibleSectors=sectorMode==='ALL'?allSectorRows:allSectorRows.filter(g=>g.verdict==='강한 섹터'||g.verdict==='개선 섹터')
  const sectorLabel=(g:SectorSummary)=>`${market==='ALL'?g.market+' · ':''}${sectorName(g.market,g.sector)}`
  const sectorOptions=eligibleSectors.slice().sort((a,b)=>sectorLabel(a).localeCompare(sectorLabel(b),'ko'))
  const shownSectors=sector?eligibleSectors.filter(g=>g.key===sector):eligibleSectors
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
    const marketKey=row.market&&row.ticker?`${row.market}|${row.ticker}`:''
    const candidates=[marketKey,String(row.ticker||''),String(row.target||'').toLowerCase(),String(row.related_assets||'').split(/[ ,/]/)[0].toLowerCase()]
    for(const k of candidates){if(k&&leaderMap.has(k))return leaderMap.get(k)||null}
    return null
  }
  const enrich=(rows:EditableRow[])=>rows.map(r=>{
    const l=matchLeader(r);if(!l)return r
    return {...r,market:l.market,ticker:l.ticker,name:l.name,sector:l.sector,industry:l.industry,stage:l.stage,leadership_class:leadership(l),verdict:l.verdict,rs_rank:l.rs_rank,current_price:l.price,price:l.price,ma50:l.ma50,ma200:l.ma200,high_52w_distance:l.high_52w_distance}
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

  const addSelectedAnalysis=()=>{
    if(!selected)return
    const next=[{id:`new-${Date.now()}`,date:new Date().toISOString().slice(0,10),market:selected.market,ticker:selected.ticker,name:selected.name,sector:selected.sector,industry:selected.industry,stage:selected.stage,leadership_class:leadership(selected),rs_rank:selected.rs_rank,eps_growth_q:null,sales_growth_q:null,eps_growth_3y:null,roe:null,operating_margin:null,debt_ratio:null,operating_cashflow_positive:null,pe:null,peg:null,moat:'',growth_driver:'',key_risk:'',auto_grade:'',conclusion:''},...analysis]
    updateAnalysis(next)
  }
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
      <section className="kpis">
        <Kpi label="핵심 주도" value={leadCount} sub="RS≥95 · 3M/6M 상대강도 양호" onClick={()=>{setSummaryTab('core');setDrillSectorKey(null);setDrillStock(null)}}/>
        <Kpi label="주도 후보" value={candidateCount} sub="Trend Template 통과 중 상위 후보" onClick={()=>{setSummaryTab('candidates');setDrillSectorKey(null);setDrillStock(null)}}/>
        <Kpi label="강세 전환" value={turnCount} sub="Next Leader" onClick={()=>{setSummaryTab('turns');setDrillSectorKey(null);setDrillStock(null)}}/>
        <Kpi label="MA50 위 비율" value={(breadth*100).toFixed(0)+'%'} sub={'/ '+stockRows.length+' 종목'}/>
      </section>
      <section className="sector-strip panel compact-panel">
        <div className="panel-head"><div><h2>섹터 필터</h2><p>시장과 섹터를 선택해 주도 종목을 좁혀보세요.</p></div></div>
        <div className="chips"><button className={!sector?'chip on':'chip'} onClick={()=>{setSector(null);setSectorKeySelected(null);setDrillSectorKey(null)}}>전체 섹터</button>{sectorOptions.map(g=><button key={g.key} className={sector===g.key?'chip on':'chip'} onClick={()=>{setSector(sector===g.key?null:g.key);setSectorKeySelected(null);setDrillSectorKey(null)}}>{sectorLabel(g)}</button>)}</div>
      </section>
      <section className="industry-layout">
        <div className="panel industry-panel">
          <div className="panel-head"><div><h2>섹터 요약</h2><p>섹터별 RS · 등락률 중앙값</p></div><div className="mini-segment"><button className={sectorMode==='HOT'?'on':''} onClick={()=>{setSectorMode('HOT');setSector(null);setSectorKeySelected(null);setDrillSectorKey(null)}}>강한·개선</button><button className={sectorMode==='ALL'?'on':''} onClick={()=>{setSectorMode('ALL');setSector(null);setSectorKeySelected(null);setDrillSectorKey(null)}}>전체</button></div></div>
          <div className="industry-table-wrap"><table className="industry-table compact-industry-table"><thead><tr><th>섹터</th><th>판정</th><th>RS</th><th>RS 5D</th><th>RS 20D</th><th>RS 50D</th><th>등락 5D</th><th>등락 20D</th><th>등락 50D</th></tr></thead><tbody>
            {shownSectors.map(g=><tr key={g.key} className={sectorKeySelected===g.key?'selected':''} onClick={()=>{setSectorKeySelected(g.key);setDrillStock(null);setDrillSectorKey(window.matchMedia('(max-width: 1180px)').matches?g.key:null)}}>
              <td className="industry-name-cell" title={sectorLabel(g)}><b>{sectorLabel(g)}</b><small>{g.n}종목</small></td><td><ValuePill tone={leadTone(g.verdict)}>{g.verdict}</ValuePill>{g.smallSample&&<small className="sample-note">n={g.n}</small>}</td><td><span className={(g.medRank??0)>=90?'heat top':(g.medRank??0)>=70?'heat high':'heat'}>{g.medRank==null?'—':Math.round(g.medRank)}</span></td>
              {([g.medRs5d,g.medRs20d,g.medRs50d,g.medRet5d,g.medRet20d,g.medRet50d] as const).map((value,i)=><td key={i} className={value!=null&&value>0?'pos':value!=null&&value<0?'neg':''}>{pct(value)}</td>)}
            </tr>)}
            {!shownSectors.length&&<tr><td colSpan={9} className="empty">조건에 맞는 섹터가 없습니다.</td></tr>}
          </tbody></table></div>
        </div>
        <div className="panel stock-panel">
          <div className="panel-head"><div><h2>주도 종목{chosenSector?' · '+sectorLabel(chosenSector):''}</h2><p>{chosenSector?`대표 ${chosenSector.top.join(', ')}`:'섹터를 선택하면 해당 종목만 표시합니다.'}</p></div>{chosenSector&&<button className="text-button" onClick={()=>setSectorKeySelected(null)}>선택 해제</button>}</div>
          <div className="tabs"><button className={stockTab==='core'?'on':''} onClick={()=>setStockTab('core')}>핵심 주도 <b>{stockGroups.core.length}</b></button><button className={stockTab==='candidates'?'on':''} onClick={()=>setStockTab('candidates')}>주도 후보 <b>{stockGroups.candidates.length}</b></button><button className={stockTab==='turns'?'on':''} onClick={()=>setStockTab('turns')}>강세 전환 <b>{stockGroups.turns.length}</b></button><button className={stockTab==='corrections'?'on':''} onClick={()=>setStockTab('corrections')}>조정 중 <b>{stockGroups.corrections.length}</b></button></div>
          <StockRows rows={tabStocks} onSelect={r=>{setSelected(r);setDrillSectorKey(sectorKey(r));setDrillStock(r)}}/>
        </div>
      </section>
      <section className="panel"><div className="panel-head"><div><h2>전체 리더보드 미리보기</h2><p>섹터 흐름을 본 뒤 종목 수준 지표를 검증합니다.</p></div><button className="text-button" onClick={()=>setPage('leaderboard')}>전체 보기 →</button></div><GridTable rows={visible.slice(0,20)} columns={leaderCols.slice(0,13)} height={470}/></section>
    </>
  }else if(page==='leaderboard'){
    content=<><div className="page-note"><b>읽는 순서</b><span>섹터 → 주도 분류 → 모멘텀 단계 → RS → 액션 가이드</span></div>{filters}<div className="panel"><GridTable rows={visible} columns={leaderCols} height={680}/></div></>
  }else if(page==='watchlist'){
    content=<><div className="page-note"><b>Watchlist</b><span>산업·섹터·리더보드 단계는 시장 데이터와 연결하고, 관심가·손절·우선순위를 직접 관리합니다.</span></div><div className="panel"><GridTable rows={enrich(watch)} columns={watchCols} editable onChange={updateWatch} height={650}/></div></>
  }else if(page==='portfolio'){
    content=<><div className="page-note"><b>Portfolio</b><span>포지션을 산업/섹터 맥락과 함께 보고 수량·평단·Stop·투자 가설을 관리합니다.</span></div><div className="panel"><GridTable rows={enrich(portfolio)} columns={portfolioCols} editable onChange={updatePortfolio} height={650}/></div></>
  }else if(page==='analysis'){
    content=<><div className="analysis-layout"><div className="panel stock-list"><div className="panel-head"><div><h2>종목 선택</h2><p>산업·RS가 강한 순</p></div></div>{visible.slice().sort((a,b)=>(b.rs_rank??0)-(a.rs_rank??0)).map(r=><button key={r.id} className={selected?.id===r.id?'on':''} onClick={()=>setSelected(r)}><b>{r.ticker}</b><span>{r.name}</span><em>{r.industry} · {r.stage}</em></button>)}</div>
      <div className="panel analysis-card">{selected?<><div className="stock-title"><div><span>{selected.market} · <b>{selected.industry}</b> · {selected.sector}</span><h2>{selected.name} <small>{selected.ticker}</small></h2></div><div><ValuePill tone={leadTone(leadership(selected))}>{leadership(selected)||'관찰'}</ValuePill></div></div>
        <StockSnapshot row={selected}/>
        <div className="checklist"><h3>리더보드 자동 체크</h3><label><span>Trend Template</span><b>{selected.leader_tt?'PASS':'CHECK'}</b></label><label><span>Price &gt; MA50 &gt; MA200</span><b>{selected.price&&selected.ma50&&selected.ma200&&selected.price>selected.ma50&&selected.ma50>selected.ma200?'PASS':'CHECK'}</b></label><label><span>RS순위 ≥ 70</span><b>{(selected.rs_rank??0)>=70?'PASS':'CHECK'}</b></label><label><span>52주 고점 -25% 이내</span><b>{(selected.high_52w_distance??-1)>=-.25?'PASS':'CHECK'}</b></label></div>
        <div className="action-box"><span>액션 가이드</span><strong>{selected.action_guide}</strong></div><button className="primary-action" onClick={addSelectedAnalysis}>이 종목 분석행 추가</button>
      </>:<p>종목을 선택하세요.</p>}</div></div>
      <div className="page-note"><b>종목분석 기록</b><span>성장·수익성·밸류·질적 분석은 직접 입력하고, 산업·섹터·모멘텀·RS는 리더보드와 자동 연결합니다.</span></div><div className="panel"><GridTable rows={enrichedAnalysis} columns={analysisTableCols} editable onChange={updateAnalysis} height={560}/></div></>
  }else if(page==='research'){
    content=<><div className="page-note"><b>Research Notes</b><span>팩트 → 해석 → 영향 → 다음 확인 순서. 종목 대상이면 리더보드의 산업·섹터·단계·RS를 연결합니다.</span></div><div className="panel"><GridTable rows={enrichedResearch} columns={researchCols} editable onChange={updateResearch} height={680}/></div></>
  }else if(page==='journal'){
    content=<><div className="page-note"><b>Trading Journal</b><span>매수 당시 가설과 리더보드 상태를 함께 기록하고, 결과 복기까지 한 행에서 추적합니다.</span></div><div className="panel"><GridTable rows={enrichedJournal} columns={journalCols} editable onChange={updateJournal} height={680}/></div></>
  }else if(page==='universe'){
    const cols:ColDef<LeaderRow>[]=[{field:'market',headerName:'시장',width:75,flex:0},{field:'ticker',headerName:'Ticker',pinned:'left',width:100,flex:0},{field:'name',headerName:'종목명',pinned:'left',minWidth:160},{field:'exchange',headerName:'거래소',minWidth:100},{field:'sector',headerName:'섹터',minWidth:170},{field:'industry',headerName:'산업',minWidth:190},{field:'index_memberships',headerName:'지수 · 유니버스',minWidth:210,valueFormatter:p=>Array.isArray(p.value)?p.value.join(' · '):'—'},{field:'index_statuses',headerName:'구성 상태',minWidth:155,valueFormatter:p=>Array.isArray(p.value)?p.value.join(' · '):'—'},{field:'data_status',headerName:'시장 데이터',minWidth:110},{field:'classification_scheme',headerName:'분류 체계',minWidth:210},{field:'classification_as_of',headerName:'분류 기준일',minWidth:115}]
    content=<><div className="page-note"><b>Universe</b><span>S&P500 · NASDAQ · KOSPI200 · KOSDAQ150 구성과 분류 출처를 자동 동기화합니다.</span></div>{filters}<div className="panel"><GridTable rows={visible.filter(r=>r.asset_class==='Equity')} columns={cols} height={650}/></div></>
  }else{
    content=<div className="settings-grid"><div className="panel"><h2>Leadership Thresholds</h2><div className="setting"><span>핵심 주도</span><b>RS ≥95 · 52W ≥-15%</b></div><div className="setting"><span>핵심 주도 확인</span><b>RS 3M/6M &gt; 0</b></div><div className="setting"><span>주도 후보</span><b>RS ≥85 · 52W ≥-20%</b></div><div className="setting"><span>Trend Template</span><b>RS ≥70 · Price &gt; MA50 &gt; MA200</b></div><div className="setting"><span>Breakout Volume</span><b>≥ 1.4x</b></div><div className="setting"><span>Next Leader 52W High</span><b>≥ -30%</b></div></div>
      <div className="panel"><h2>Account & Storage</h2><p className="note">{session?'로그인됨 · Watchlist / Portfolio / Research / Analysis / Journal은 Supabase에 저장됩니다.':'로그인하지 않은 편집 내용은 이 기기의 브라우저에만 저장됩니다.'}</p><div className="setting"><span>Market Data</span><b>Supabase Live</b></div><div className="setting"><span>Personal Data</span><b>{session?'Cloud + RLS':'Local only'}</b></div><button className="settings-auth" onClick={()=>session?updateSession(null):setAuthOpen(true)}>{session?'로그아웃':'로그인 / 최초 등록'}</button></div></div>
  }

  const pageTitle:Record<string,string>={dashboard:'Investment Dashboard',leaderboard:'Leaderboard',watchlist:'Watchlist',portfolio:'Portfolio',analysis:'종목 분석',research:'Research Notes',journal:'Trading Journal',universe:'Universe',settings:'Settings'}
  const closeDrill=()=>{setDrillStock(null);setDrillSectorKey(null);setSummaryTab(null)}
  const drillOverlay=<Dialog open={drillOpen} onOpenChange={open=>{if(!open)closeDrill()}}>
    <DialogContent ref={drillRef} className="drill-sheet">
      <div className="drill-handle"/>
      <div className="drill-head">
        <div>{drillStock&&<button className="drill-back" onClick={()=>{if(summaryTab||window.matchMedia('(max-width: 1180px)').matches)setDrillStock(null);else closeDrill()}}>← {summaryTab?'목록':'섹터'}</button>}<small>{summaryTab?(market==='ALL'?'전체 시장':market):drillStock?sectorName(drillStock.market,drillStock.sector):(drillSector?.market||'Sector')}</small><DialogTitle>{drillStock?drillStock.name:summaryTab?`주도 종목 · ${{core:'핵심 주도',candidates:'주도 후보',turns:'강세 전환'}[summaryTab]}`:(drillSector?sectorName(drillSector.market,drillSector.sector):'섹터 상세')}</DialogTitle><DialogDescription className="sr-only">분류별 주도 종목과 상세 리더십 지표</DialogDescription></div>
        <DialogClose asChild><button className="drill-close" aria-label="닫기">×</button></DialogClose>
      </div>
      {drillStock?<div className="drill-stock-detail drill-content">
        <div className="drill-meta drill-animate"><ValuePill tone={leadTone(leadership(drillStock))}>{leadership(drillStock)||'관찰'}</ValuePill><ValuePill tone={stageTone(drillStock.stage)}>{drillStock.stage}</ValuePill><span>{drillStock.market} · {drillStock.ticker}</span></div>
        <StockSnapshot row={drillStock}/>
        <div className="drill-guide drill-animate"><span>액션 가이드</span><strong>{drillStock.action_guide}</strong></div>
        <div className="drill-checks drill-animate"><span>Trend Template</span><b>{drillStock.leader_tt?'PASS':'CHECK'}</b><span>추세</span><b>{drillStock.price&&drillStock.ma50&&drillStock.ma200&&drillStock.price>drillStock.ma50&&drillStock.ma50>drillStock.ma200?'Price > MA50 > MA200':'확인 필요'}</b></div>
        <button className="primary-action" onClick={()=>{const r=drillStock!;setSelected(r);const next=[{id:'new-'+Date.now(),date:new Date().toISOString().slice(0,10),market:r.market,ticker:r.ticker,name:r.name,sector:r.sector,industry:r.industry,stage:r.stage,leadership_class:leadership(r),rs_rank:r.rs_rank,lynch_category:'',eps_growth_q:null,sales_growth_q:null,eps_growth_3y:null,roe:null,operating_margin:null,debt_ratio:null,operating_cashflow_positive:null,pe:null,peg:null,moat:'',growth_driver:'',key_risk:'',auto_grade:'',conclusion:'',research_note_no:'',journal_no:''},...analysis];updateAnalysis(next)}}>종목분석에 기록 추가</button>
      </div>:summaryTab?<div className="drill-content drill-summary-list">
        <p className="drill-note">{market==='ALL'?'전체 시장':market} · {summaryGroups[summaryTab].length}종목 · RS순위 높은 순</p>
        <StockRows rows={summaryGroups[summaryTab].slice().sort((a,b)=>(b.rs_rank??0)-(a.rs_rank??0))} onSelect={r=>{setSelected(r);setDrillStock(r)}}/>
      </div>:<div className="drill-industry-detail drill-content">
        <div className="drill-summary"><Kpi label="판정" value={drillSector?.verdict??'—'}/><Kpi label="종목 수" value={drillSector?.n??0}/><Kpi label="핵심 주도 비율" value={drillSector?pct(drillSector.coreShare):'—'}/><Kpi label="MA50 위" value={drillSector?pct(drillSector.breadth):'—'}/><Kpi label="RS순위 중앙값" value={drillSector?.medRank==null?'—':Math.round(drillSector.medRank)}/><Kpi label="RS 50D" value={drillSector?pct(drillSector.medRs50d):'—'}/></div>
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
  return <div className="shell"><Sidebar page={page} setPage={setPage}/><main><header className="topbar"><div><h1>{pageTitle[page]||page}</h1><p>Industry → Stock · Sector as context · Leadership & Risk Workspace</p></div><div className="top-actions"><span className={'source '+source}>{source==='supabase'?'● Supabase Live':'○ Demo / Local'}</span><span className={'sync-state '+syncState}>{session?(syncState==='saving'?'☁ 저장 중':syncState==='loading'?'☁ 불러오는 중':syncState==='error'?'☁ 동기화 오류':'☁ 저장됨'):'기기 저장'}</span><button onClick={()=>session?updateSession(null):setAuthOpen(true)}>{session?'로그아웃':'로그인'}</button><button onClick={()=>setPage('settings')}>환경 설정</button></div></header><div className="content">{content}</div><AuthModal open={authOpen} onClose={()=>setAuthOpen(false)} onAuthenticated={updateSession}/></main>{drillOverlay}{deleteDialog}</div>
}
