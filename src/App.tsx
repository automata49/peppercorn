import { useEffect, useMemo, useState } from 'react'
import type { ColDef } from 'ag-grid-community'
import { Sidebar } from './components/Sidebar'
import { GridTable } from './components/GridTable'
import { AuthModal } from './components/AuthModal'
import { initialAnalysis, initialJournal, initialPortfolio, initialResearch, initialWatchlist } from './data/mock'
import { loadLeaderboard } from './lib/rest'
import { loadStoredSession, loadWorkspace, saveWorkspace, storeSession, type Session, type WorkspaceResource } from './lib/session'
import type { EditableRow, LeaderRow, Market } from './types'

const pct=(v:number|null|undefined)=>v==null?'—':(v>=0?'+':'')+(v*100).toFixed(1)+'%'
const num=(v:number|null|undefined)=>v==null?'—':v.toLocaleString('ko-KR')
const med=(values:(number|null|undefined)[])=>{
  const a=values.filter((v):v is number=>typeof v==='number'&&Number.isFinite(v)).sort((x,y)=>x-y)
  if(!a.length) return null
  const m=Math.floor(a.length/2)
  return a.length%2?a[m]:(a[m-1]+a[m])/2
}
const leadership=(r:LeaderRow)=>r.leadership_class||((r.leader_tt||r.verdict==='1. 주도')?'1. 주도':(String(r.verdict).includes('강세 전환')||String(r.stage).includes('넥스트 리더')?'2. 강세 전환':''))
const isCorrection=(r:LeaderRow)=>String(r.stage).includes('조정 중')
const stageTone=(s:string)=>s.startsWith('▲')?'green':s.startsWith('●')?'green-soft':s.startsWith('◆')?'blue':s.startsWith('■')?'violet':s.startsWith('◇')?'teal':s.startsWith('↻')?'amber':s.startsWith('⛔')?'red':s.startsWith('❌')?'gray':'gray'
const leadTone=(s:string)=>s==='1. 주도'?'green':s==='2. 강세 전환'?'amber':s==='약세'?'red':'gray'

function useLocalRows<T>(key:string,initial:T[]){
  const [rows,setRows]=useState<T[]>(()=>{
    try{const saved=localStorage.getItem(key);return saved?JSON.parse(saved) as T[]:initial}catch{return initial}
  })
  const update=(next:T[])=>{setRows(next);localStorage.setItem(key,JSON.stringify(next))}
  return [rows,update] as const
}

type IndustrySummary={
  key:string;market:Market;industry:string;sector:string;n:number;lead:number;turn:number;correction:number;
  leadShare:number;breadth:number;medRank:number|null;medRs1w:number|null;medRet1w:number|null;medRet1m:number|null;verdict:string;top:string[]
}

function buildIndustries(rows:LeaderRow[]):IndustrySummary[]{
  const groups=new Map<string,LeaderRow[]>()
  for(const r of rows){
    const industry=(r.industry||'분류 확인').trim()||'분류 확인'
    const key=`${r.market}|${r.sector||'분류 확인'}|${industry}`
    const list=groups.get(key)||[];list.push(r);groups.set(key,list)
  }
  return [...groups.entries()].map(([key,list])=>{
    const n=list.length
    const lead=list.filter(r=>leadership(r)==='1. 주도').length
    const turn=list.filter(r=>leadership(r)==='2. 강세 전환').length
    const correction=list.filter(isCorrection).length
    const leadShare=n?lead/n:0
    const breadth=n?list.filter(r=>r.price!=null&&r.ma50!=null&&Number(r.price)>Number(r.ma50)).length/n:0
    const medRank=med(list.map(r=>r.rs_rank))
    const medRs1w=med(list.map(r=>r.rs_1w))
    const medRet1w=med(list.map(r=>r.return_1w))
    const medRet1m=med(list.map(r=>r.return_1m))
    let verdict='중립'
    if(n<3) verdict='— 표본 부족'
    else if(leadShare>=.30&&(medRank??0)>=60) verdict='1. 주도'
    else if((lead+turn+correction)/n>=.40&&breadth>=.50&&(medRs1w??-1)>0) verdict='2. 강세 전환'
    else if(breadth<.35&&(medRank??50)<45) verdict='약세'
    const ranked=list.slice().sort((a,b)=>(b.rs_rank??0)-(a.rs_rank??0)).slice(0,3).map(r=>r.name)
    return {key,market:list[0].market,industry:list[0].industry||'분류 확인',sector:list[0].sector||'분류 확인',n,lead,turn,correction,leadShare,breadth,medRank,medRs1w,medRet1w,medRet1m,verdict,top:ranked}
  }).sort((a,b)=>(b.medRank??-1)-(a.medRank??-1)||b.leadShare-a.leadShare)
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
  {headerName:'주도 분류',minWidth:115,valueGetter:p=>p.data?leadership(p.data):'',cellClassRules:{'lead-one':p=>p.value==='1. 주도','lead-two':p=>p.value==='2. 강세 전환'}},
  {field:'stage',headerName:'모멘텀 단계',minWidth:150,cellClassRules:stageRules},
  {field:'verdict',headerName:'최종 판단',minWidth:135},
  {field:'price',headerName:'현재가',valueFormatter:p=>num(p.value)},
  {field:'rs_rank',headerName:'RS순위',cellClassRules:{'rank-high':p=>Number(p.value)>=70,'rank-top':p=>Number(p.value)>=90}},
  {field:'rs_1w',headerName:'RS 1W',valueFormatter:p=>pct(p.value),cellClassRules:upDownRules},
  {field:'rs_1m',headerName:'RS 1M',valueFormatter:p=>pct(p.value),cellClassRules:upDownRules},
  {field:'return_1w',headerName:'등락 1W',valueFormatter:p=>pct(p.value),cellClassRules:upDownRules},
  {field:'return_1m',headerName:'등락 1M',valueFormatter:p=>pct(p.value),cellClassRules:upDownRules},
  {field:'high_52w_distance',headerName:'52W High',valueFormatter:p=>pct(p.value)},
  {field:'volume_ratio',headerName:'거래량 배수',valueFormatter:p=>p.value==null?'—':Number(p.value).toFixed(2)+'x'},
  {field:'rsi14',headerName:'RSI'},
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
  {field:'date',headerName:'작성일',width:112,flex:0},{field:'type',headerName:'구분',width:95,flex:0},{field:'target',headerName:'대상',minWidth:150},
  {field:'market',headerName:'시장(연결)',editable:false,width:98,flex:0},{field:'ticker',headerName:'Ticker(연결)',editable:false,width:115,flex:0},
  {field:'industry',headerName:'산업(연결)',editable:false,minWidth:150},{field:'sector',headerName:'섹터(연결)',editable:false,minWidth:135},
  {field:'title',headerName:'제목',minWidth:210},{field:'fact',headerName:'핵심 사실',minWidth:280},{field:'interpretation',headerName:'내 해석',minWidth:280},
  {field:'source',headerName:'출처',minWidth:170},{field:'source_type',headerName:'출처 유형',minWidth:115},{field:'verified',headerName:'검증',width:90,flex:0,valueFormatter:p=>p.value===true?'확인됨':p.value===false?'미검증':'—'},
  {field:'market_impact',headerName:'시장 영향',width:100,flex:0},{field:'related_assets',headerName:'관련 종목·섹터',minWidth:180},
  {field:'importance',headerName:'중요도',width:90,flex:0,cellClassRules:{'rank-high':p=>Number(p.value)>=4}},
  {field:'next_review_date',headerName:'다음 확인일',width:120,flex:0},{field:'status',headerName:'상태',width:110,flex:0},
  {field:'stage',headerName:'리더보드 단계',editable:false,minWidth:145,cellClassRules:stageRules},{field:'leadership_class',headerName:'주도 분류',editable:false,minWidth:110},
  {field:'rs_rank',headerName:'RS순위',editable:false,width:90,flex:0,cellClassRules:{'rank-high':p=>Number(p.value)>=70,'rank-top':p=>Number(p.value)>=90}}
]
const analysisCols:ColDef<EditableRow>[]=[
  {field:'date',headerName:'분석일',width:110,flex:0},{field:'market',headerName:'시장',editable:false,width:78,flex:0},{field:'ticker',headerName:'Ticker',editable:false,pinned:'left',width:98,flex:0},
  {field:'name',headerName:'종목명',editable:false,minWidth:145},{field:'industry',headerName:'산업',editable:false,minWidth:150},{field:'sector',headerName:'섹터',editable:false,minWidth:130},
  {field:'stage',headerName:'단계(자동)',editable:false,minWidth:145,cellClassRules:stageRules},{field:'leadership_class',headerName:'주도 분류',editable:false,minWidth:110},
  {field:'rs_rank',headerName:'RS순위',editable:false,width:90,flex:0,cellClassRules:{'rank-high':p=>Number(p.value)>=70,'rank-top':p=>Number(p.value)>=90}},
  {field:'eps_growth_q',headerName:'EPS YoY',valueFormatter:p=>pct(p.value),cellClassRules:upDownRules},{field:'sales_growth_q',headerName:'매출 YoY',valueFormatter:p=>pct(p.value),cellClassRules:upDownRules},
  {field:'eps_growth_3y',headerName:'EPS 3Y',valueFormatter:p=>pct(p.value),cellClassRules:upDownRules},{field:'roe',headerName:'ROE',valueFormatter:p=>pct(p.value),cellClassRules:upDownRules},
  {field:'operating_margin',headerName:'영업이익률',valueFormatter:p=>pct(p.value),cellClassRules:upDownRules},{field:'debt_ratio',headerName:'부채비율',valueFormatter:p=>pct(p.value)},
  {field:'operating_cashflow_positive',headerName:'영업CF +',width:95,flex:0},{field:'pe',headerName:'PER'},{field:'peg',headerName:'PEG'},
  {field:'moat',headerName:'경쟁우위(해자)',minWidth:220},{field:'growth_driver',headerName:'성장 동력',minWidth:220},{field:'key_risk',headerName:'핵심 리스크',minWidth:220},
  {field:'auto_grade',headerName:'자동 판정',width:110,flex:0},{field:'conclusion',headerName:'내 결론',minWidth:180}
]
const journalCols:ColDef<EditableRow>[]=[
  {field:'date',headerName:'날짜',width:110,flex:0},{field:'account',headerName:'계좌',width:95,flex:0},{field:'market',headerName:'시장(연결)',editable:false,width:98,flex:0},
  {field:'ticker',headerName:'Ticker',pinned:'left',width:100,flex:0},{field:'name',headerName:'종목명',editable:false,minWidth:140},{field:'industry',headerName:'산업(연결)',editable:false,minWidth:150},{field:'sector',headerName:'섹터(연결)',editable:false,minWidth:130},
  {field:'stage',headerName:'단계(자동)',editable:false,minWidth:145,cellClassRules:stageRules},{field:'leadership_class',headerName:'주도 분류',editable:false,minWidth:110},
  {field:'rs_rank',headerName:'RS순위',editable:false,width:90,flex:0,cellClassRules:{'rank-high':p=>Number(p.value)>=70,'rank-top':p=>Number(p.value)>=90}},
  {field:'tranche',headerName:'분할차수',width:95,flex:0},{field:'buy_price',headerName:'매수가'},{field:'currency',headerName:'통화',width:80,flex:0},
  {field:'thesis',headerName:'매수 이유(가설)',minWidth:300},{field:'evidence_type',headerName:'근거 유형',minWidth:110},{field:'confidence',headerName:'확신도',width:85,flex:0},
  {field:'target_price',headerName:'목표가'},{field:'stop_price',headerName:'손절가'},{field:'review_condition',headerName:'재검토 조건',minWidth:240},{field:'review_date',headerName:'재검토일',width:118,flex:0},
  {field:'status',headerName:'상태',width:110,flex:0},{field:'exit_date',headerName:'결과일',width:110,flex:0},{field:'sell_price',headerName:'매도가'},
  {field:'realized_return',headerName:'실현수익률',valueFormatter:p=>pct(p.value),cellClassRules:upDownRules},{field:'review_note',headerName:'결과 복기',minWidth:240},{field:'lesson',headerName:'교훈',minWidth:240}
]

function Kpi({label,value,sub}:{label:string;value:string|number;sub?:string}){
  return <div className="kpi"><span>{label}</span><strong>{value}</strong>{sub&&<small>{sub}</small>}</div>
}

function ValuePill({children,tone='gray'}:{children:any;tone?:string}){return <span className={'pill '+tone}>{children}</span>}

export default function App(){
  const [page,setPage]=useState('dashboard')
  const [leaders,setLeaders]=useState<LeaderRow[]>([])
  const [source,setSource]=useState<'demo'|'supabase'>('demo')
  const [market,setMarket]=useState<'ALL'|Market>('ALL')
  const [query,setQuery]=useState('')
  const [sector,setSector]=useState<string|null>(null)
  const [industryKey,setIndustryKey]=useState<string|null>(null)
  const [industryMode,setIndustryMode]=useState<'HOT'|'ALL'>('ALL')
  const [stockTab,setStockTab]=useState<'leaders'|'turns'|'corrections'>('leaders')
  const [selected,setSelected]=useState<LeaderRow|null>(null)
  const [watch,setWatch]=useLocalRows<EditableRow>('peppercorn-watchlist',initialWatchlist)
  const [portfolio,setPortfolio]=useLocalRows<EditableRow>('peppercorn-portfolio',initialPortfolio)
  const [research,setResearch]=useLocalRows<EditableRow>('peppercorn-research',initialResearch)
  const [analysis,setAnalysis]=useLocalRows<EditableRow>('peppercorn-analysis',initialAnalysis)
  const [journal,setJournal]=useLocalRows<EditableRow>('peppercorn-journal',initialJournal)
  const [session,setSessionState]=useState<Session|null>(()=>loadStoredSession())
  const [authOpen,setAuthOpen]=useState(false)
  const [syncState,setSyncState]=useState<'local'|'loading'|'saving'|'saved'|'error'>(session?'loading':'local')

  const updateSession=(next:Session|null)=>{setSessionState(next);storeSession(next);setSyncState(next?'saved':'local')}

  useEffect(()=>{loadLeaderboard().then(r=>{setLeaders(r.rows);setSource(r.source);setSelected(r.rows[0]??null)})},[])
  useEffect(()=>{setSector(null);setIndustryKey(null)},[market])

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
    return marketRows.filter(r=>!q||(r.ticker+' '+r.name+' '+r.sector+' '+r.industry).toLowerCase().includes(q))
  },[marketRows,query])
  const leadCount=marketRows.filter(r=>leadership(r)==='1. 주도').length
  const turnCount=marketRows.filter(r=>leadership(r)==='2. 강세 전환').length
  const avgRank=marketRows.length?Math.round(marketRows.reduce((a,r)=>a+(r.rs_rank??0),0)/marketRows.length):0
  const breadth=marketRows.length?marketRows.filter(r=>r.price&&r.ma50&&r.price>r.ma50).length/marketRows.length:0

  const sectorNames=useMemo<string[]>(()=>Array.from(new Set<string>(marketRows.map(r=>r.sector||'분류 확인'))).sort((a,b)=>a.localeCompare(b,'ko')),[marketRows])
  const industryRows=useMemo(()=>buildIndustries(marketRows.filter(r=>!sector||r.sector===sector)),[marketRows,sector])
  const shownIndustries=industryMode==='ALL'?industryRows:industryRows.filter(g=>g.verdict==='1. 주도'||g.verdict==='2. 강세 전환')
  const chosenIndustry=industryRows.find(g=>g.key===industryKey)||null
  const scopedStocks=visible.filter(r=>(!sector||r.sector===sector)&&(!chosenIndustry||`${r.market}|${r.sector||'분류 확인'}|${r.industry||'분류 확인'}`===chosenIndustry.key))
  const tabStocks=scopedStocks.filter(r=>stockTab==='leaders'?leadership(r)==='1. 주도':stockTab==='turns'?leadership(r)==='2. 강세 전환':isCorrection(r)).sort((a,b)=>(b.rs_rank??0)-(a.rs_rank??0))

  const leaderMap=useMemo(()=>{
    const m=new Map<string,LeaderRow>()
    for(const r of leaders){m.set(`${r.market}|${r.ticker}`,r);if(!m.has(r.ticker))m.set(r.ticker,r);m.set(r.name.toLowerCase(),r)}
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
    return {...r,market:l.market,ticker:l.ticker,name:l.name,sector:l.sector,industry:l.industry,stage:l.stage,leadership_class:leadership(l),rs_rank:l.rs_rank,current_price:l.price}
  })
  const enrichedResearch=enrich(research)
  const enrichedAnalysis=enrich(analysis)
  const enrichedJournal=enrich(journal)

  const filters=<div className="toolbar">
    <div className="segment">{(['ALL','KR','US'] as const).map(m=><button key={m} className={market===m?'on':''} onClick={()=>setMarket(m)}>{m==='ALL'?'전체':m}</button>)}</div>
    <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Ticker · 종목 · 산업 · 섹터 검색"/>
  </div>

  const addSelectedAnalysis=()=>{
    if(!selected)return
    const next=[{id:`new-${Date.now()}`,date:new Date().toISOString().slice(0,10),market:selected.market,ticker:selected.ticker,name:selected.name,sector:selected.sector,industry:selected.industry,stage:selected.stage,leadership_class:leadership(selected),rs_rank:selected.rs_rank,eps_growth_q:null,sales_growth_q:null,eps_growth_3y:null,roe:null,operating_margin:null,debt_ratio:null,operating_cashflow_positive:null,pe:null,peg:null,moat:'',growth_driver:'',key_risk:'',auto_grade:'',conclusion:''},...analysis]
    updateAnalysis(next)
  }

  let content
  if(page==='dashboard'){
    content=<>{filters}
      <section className="kpis">
        <Kpi label="1. 주도주" value={leadCount} sub={'/ '+marketRows.length+' 종목'}/>
        <Kpi label="2. 강세 전환" value={turnCount} sub="Next Leader 포함"/>
        <Kpi label="MA50 위 비율" value={(breadth*100).toFixed(0)+'%'} sub="시장 참여도"/>
        <Kpi label="RS순위 평균" value={avgRank} sub="현재 시장 필터"/>
      </section>
      <section className="sector-strip panel compact-panel">
        <div className="panel-head"><div><h2>섹터 필터</h2><p>섹터는 보조 필터입니다. 아래 산업 흐름을 먼저 확인하세요.</p></div></div>
        <div className="chips"><button className={!sector?'chip on':'chip'} onClick={()=>{setSector(null);setIndustryKey(null)}}>전체 섹터</button>{sectorNames.map(s=><button key={s} className={sector===s?'chip on':'chip'} onClick={()=>{setSector(sector===s?null:s);setIndustryKey(null)}}>{s}</button>)}</div>
      </section>
      <section className="industry-layout">
        <div className="panel industry-panel">
          <div className="panel-head"><div><h2>산업 요약</h2><p>Industry 우선 · RS순위와 주도 비율로 강한 그룹을 빠르게 확인</p></div><div className="mini-segment"><button className={industryMode==='HOT'?'on':''} onClick={()=>setIndustryMode('HOT')}>주도·전환</button><button className={industryMode==='ALL'?'on':''} onClick={()=>setIndustryMode('ALL')}>전체</button></div></div>
          <div className="industry-table-wrap"><table className="industry-table"><thead><tr><th>산업 · 섹터</th><th>판정</th><th>종목</th><th>주도 비율</th><th>MA50 위</th><th>RS순위</th><th>RS 1W</th></tr></thead><tbody>
            {shownIndustries.map(g=><tr key={g.key} className={industryKey===g.key?'selected':''} onClick={()=>setIndustryKey(industryKey===g.key?null:g.key)}>
              <td><b>{g.industry}</b><small>{g.market} · {g.sector}</small></td><td><ValuePill tone={leadTone(g.verdict)}>{g.verdict}</ValuePill></td><td>{g.n}</td><td>{(g.leadShare*100).toFixed(0)}%</td><td>{(g.breadth*100).toFixed(0)}%</td><td><span className={(g.medRank??0)>=90?'heat top':(g.medRank??0)>=70?'heat high':'heat'}>{g.medRank==null?'—':Math.round(g.medRank)}</span></td><td className={(g.medRs1w??0)>0?'pos':(g.medRs1w??0)<0?'neg':''}>{pct(g.medRs1w)}</td>
            </tr>)}
            {!shownIndustries.length&&<tr><td colSpan={7} className="empty">조건에 맞는 산업이 없습니다.</td></tr>}
          </tbody></table></div>
        </div>
        <div className="panel stock-panel">
          <div className="panel-head"><div><h2>{chosenIndustry?chosenIndustry.industry:'주도 종목'}</h2><p>{chosenIndustry?`${chosenIndustry.sector} · 대표 ${chosenIndustry.top.join(', ')}`:'산업을 선택하면 해당 종목만 표시합니다.'}</p></div>{chosenIndustry&&<button className="text-button" onClick={()=>setIndustryKey(null)}>선택 해제</button>}</div>
          <div className="tabs"><button className={stockTab==='leaders'?'on':''} onClick={()=>setStockTab('leaders')}>1. 주도주</button><button className={stockTab==='turns'?'on':''} onClick={()=>setStockTab('turns')}>2. 강세 전환</button><button className={stockTab==='corrections'?'on':''} onClick={()=>setStockTab('corrections')}>◇ 조정 중</button></div>
          <div className="stock-rows">{tabStocks.slice(0,24).map(r=><button key={r.id} className="stock-row" onClick={()=>{setSelected(r);setPage('analysis')}}>
            <div className="stock-id"><b>{r.name}</b><small>{r.market} · {r.ticker} · {r.industry}</small></div><ValuePill tone={stageTone(r.stage)}>{r.stage}</ValuePill><strong className={(r.rs_rank??0)>=90?'rank rank-top':(r.rs_rank??0)>=70?'rank rank-high':'rank'}>{r.rs_rank??'—'}</strong><span className={(r.rs_1w??0)>0?'pos':(r.rs_1w??0)<0?'neg':''}>{pct(r.rs_1w)}</span><span className={(r.return_1w??0)>0?'pos':(r.return_1w??0)<0?'neg':''}>{pct(r.return_1w)}</span>
          </button>)}{!tabStocks.length&&<div className="empty">선택한 범위에 해당 종목이 없습니다.</div>}</div>
        </div>
      </section>
      <section className="panel"><div className="panel-head"><div><h2>전체 리더보드 미리보기</h2><p>산업 중심 탐색 후 종목 수준 지표를 검증합니다.</p></div><button className="text-button" onClick={()=>setPage('leaderboard')}>전체 보기 →</button></div><GridTable rows={visible.slice(0,20)} columns={leaderCols.slice(0,14)} height={470}/></section>
    </>
  }else if(page==='leaderboard'){
    content=<><div className="page-note"><b>읽는 순서</b><span>산업 → 주도 분류 → 모멘텀 단계 → RS → 액션 가이드</span></div>{filters}<div className="panel"><GridTable rows={visible} columns={leaderCols} height={680}/></div></>
  }else if(page==='watchlist'){
    content=<><div className="page-note"><b>Watchlist</b><span>산업·섹터·리더보드 단계는 시장 데이터와 연결하고, 관심가·손절·우선순위를 직접 관리합니다.</span></div><div className="panel"><GridTable rows={enrich(watch)} columns={watchCols} editable onChange={updateWatch} height={650}/></div></>
  }else if(page==='portfolio'){
    content=<><div className="page-note"><b>Portfolio</b><span>포지션을 산업/섹터 맥락과 함께 보고 수량·평단·Stop·투자 가설을 관리합니다.</span></div><div className="panel"><GridTable rows={enrich(portfolio)} columns={portfolioCols} editable onChange={updatePortfolio} height={650}/></div></>
  }else if(page==='analysis'){
    content=<><div className="analysis-layout"><div className="panel stock-list"><div className="panel-head"><div><h2>종목 선택</h2><p>산업·RS가 강한 순</p></div></div>{visible.slice().sort((a,b)=>(b.rs_rank??0)-(a.rs_rank??0)).map(r=><button key={r.id} className={selected?.id===r.id?'on':''} onClick={()=>setSelected(r)}><b>{r.ticker}</b><span>{r.name}</span><em>{r.industry} · {r.stage}</em></button>)}</div>
      <div className="panel analysis-card">{selected?<><div className="stock-title"><div><span>{selected.market} · <b>{selected.industry}</b> · {selected.sector}</span><h2>{selected.name} <small>{selected.ticker}</small></h2></div><div><ValuePill tone={leadTone(leadership(selected))}>{leadership(selected)||'관찰'}</ValuePill></div></div>
        <div className="metric-grid"><Kpi label="현재가" value={num(selected.price)}/><Kpi label="RS순위" value={selected.rs_rank??'—'}/><Kpi label="RS 1W" value={pct(selected.rs_1w)}/><Kpi label="RS 1M" value={pct(selected.rs_1m)}/><Kpi label="52W High" value={pct(selected.high_52w_distance)}/><Kpi label="거래량" value={(selected.volume_ratio??0).toFixed(2)+'x'}/><Kpi label="RSI(14)" value={selected.rsi14??'—'}/><Kpi label="ATR배수" value={(selected.atr_multiple??0).toFixed(1)+'x'}/></div>
        <div className="checklist"><h3>리더보드 자동 체크</h3><label><span>Trend Template</span><b>{selected.leader_tt?'PASS':'CHECK'}</b></label><label><span>Price &gt; MA50 &gt; MA200</span><b>{selected.price&&selected.ma50&&selected.ma200&&selected.price>selected.ma50&&selected.ma50>selected.ma200?'PASS':'CHECK'}</b></label><label><span>RS순위 ≥ 70</span><b>{(selected.rs_rank??0)>=70?'PASS':'CHECK'}</b></label><label><span>52주 고점 -25% 이내</span><b>{(selected.high_52w_distance??-1)>=-.25?'PASS':'CHECK'}</b></label></div>
        <div className="action-box"><span>액션 가이드</span><strong>{selected.action_guide}</strong></div><button className="primary-action" onClick={addSelectedAnalysis}>이 종목 분석행 추가</button>
      </>:<p>종목을 선택하세요.</p>}</div></div>
      <div className="page-note"><b>종목분석 기록</b><span>성장·수익성·밸류·질적 분석은 직접 입력하고, 산업·섹터·모멘텀·RS는 리더보드와 자동 연결합니다.</span></div><div className="panel"><GridTable rows={enrichedAnalysis} columns={analysisCols} editable onChange={updateAnalysis} height={560}/></div></>
  }else if(page==='research'){
    content=<><div className="page-note"><b>Research Notes</b><span>팩트 → 해석 → 영향 → 다음 확인 순서. 종목 대상이면 리더보드의 산업·섹터·단계·RS를 연결합니다.</span></div><div className="panel"><GridTable rows={enrichedResearch} columns={researchCols} editable onChange={updateResearch} height={680}/></div></>
  }else if(page==='journal'){
    content=<><div className="page-note"><b>Trading Journal</b><span>매수 당시 가설과 리더보드 상태를 함께 기록하고, 결과 복기까지 한 행에서 추적합니다.</span></div><div className="panel"><GridTable rows={enrichedJournal} columns={journalCols} editable onChange={updateJournal} height={680}/></div></>
  }else if(page==='universe'){
    const cols:ColDef<LeaderRow>[]=[{field:'market',headerName:'시장'},{field:'asset_class',headerName:'Asset'},{field:'ticker',headerName:'Ticker',pinned:'left'},{field:'name',headerName:'종목명',pinned:'left',minWidth:160},{field:'industry',headerName:'산업',minWidth:180},{field:'sector',headerName:'섹터',minWidth:170}]
    content=<><div className="page-note"><b>Universe</b><span>산업을 1차 분류로 보고 섹터를 상위 보조 분류로 유지합니다.</span></div>{filters}<div className="panel"><GridTable rows={visible} columns={cols} height={650}/></div></>
  }else{
    content=<div className="settings-grid"><div className="panel"><h2>Analysis Thresholds</h2><div className="setting"><span>Leader RS Rank</span><b>≥ 70</b></div><div className="setting"><span>Leader 52W High</span><b>≥ -25%</b></div><div className="setting"><span>Breakout Zone</span><b>≥ -5%</b></div><div className="setting"><span>Breakout Volume</span><b>≥ 1.4x</b></div><div className="setting"><span>Max Stop</span><b>8%</b></div><div className="setting"><span>Next Leader 52W High</span><b>≥ -30%</b></div></div>
      <div className="panel"><h2>Account & Storage</h2><p className="note">{session?'로그인됨 · Watchlist / Portfolio / Research / Analysis / Journal은 Supabase에 저장됩니다.':'로그인하지 않은 편집 내용은 이 기기의 브라우저에만 저장됩니다.'}</p><div className="setting"><span>Market Data</span><b>Supabase Live</b></div><div className="setting"><span>Personal Data</span><b>{session?'Cloud + RLS':'Local only'}</b></div><button className="settings-auth" onClick={()=>session?updateSession(null):setAuthOpen(true)}>{session?'로그아웃':'로그인 / 최초 등록'}</button></div></div>
  }

  const pageTitle:Record<string,string>={dashboard:'Investment Dashboard',leaderboard:'Leaderboard',watchlist:'Watchlist',portfolio:'Portfolio',analysis:'Stock Analysis',research:'Research Notes',journal:'Trading Journal',universe:'Universe',settings:'Settings'}
  return <div className="shell"><Sidebar page={page} setPage={setPage}/><main><header className="topbar"><div><h1>{pageTitle[page]||page}</h1><p>Industry → Stock · Sector as context · Leadership & Risk Workspace</p></div><div className="top-actions"><span className={'source '+source}>{source==='supabase'?'● Supabase Live':'○ Demo / Local'}</span><span className={'sync-state '+syncState}>{session?(syncState==='saving'?'☁ 저장 중':syncState==='loading'?'☁ 불러오는 중':syncState==='error'?'☁ 동기화 오류':'☁ 저장됨'):'기기 저장'}</span><button onClick={()=>session?updateSession(null):setAuthOpen(true)}>{session?'로그아웃':'로그인'}</button><button onClick={()=>setPage('settings')}>환경 설정</button></div></header><div className="content">{content}</div><AuthModal open={authOpen} onClose={()=>setAuthOpen(false)} onAuthenticated={updateSession}/></main></div>
}
