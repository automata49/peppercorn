import { useEffect, useMemo, useState } from 'react'
import type { ColDef } from 'ag-grid-community'
import { Sidebar } from './components/Sidebar'
import { GridTable } from './components/GridTable'
import { initialJournal, initialPortfolio, initialResearch, initialWatchlist } from './data/mock'
import { loadLeaderboard } from './lib/rest'
import type { EditableRow, LeaderRow, Market } from './types'

const pct=(v:number|null|undefined)=>v==null?'—':(v>=0?'+':'')+(v*100).toFixed(1)+'%'
const num=(v:number|null|undefined)=>v==null?'—':v.toLocaleString('ko-KR')

function useLocalRows<T>(key:string,initial:T[]){
  const [rows,setRows]=useState<T[]>(()=>{
    try{const saved=localStorage.getItem(key);return saved?JSON.parse(saved) as T[]:initial}catch{return initial}
  })
  const update=(next:T[])=>{setRows(next);localStorage.setItem(key,JSON.stringify(next))}
  return [rows,update] as const
}

const leaderCols:ColDef<LeaderRow>[]=[
  {field:'market',headerName:'시장',width:78,flex:0},
  {field:'ticker',headerName:'Ticker',width:95,flex:0,pinned:'left'},
  {field:'name',headerName:'종목명',minWidth:150,pinned:'left'},
  {field:'verdict',headerName:'최종 판단',minWidth:120},
  {field:'stage',headerName:'모멘텀 단계',minWidth:145},
  {field:'price',headerName:'현재가',valueFormatter:p=>num(p.value)},
  {field:'rs_rank',headerName:'RS순위'},
  {field:'rs_1w',headerName:'RS 1W',valueFormatter:p=>pct(p.value)},
  {field:'rs_1m',headerName:'RS 1M',valueFormatter:p=>pct(p.value)},
  {field:'return_1w',headerName:'등락 1W',valueFormatter:p=>pct(p.value)},
  {field:'return_1m',headerName:'등락 1M',valueFormatter:p=>pct(p.value)},
  {field:'high_52w_distance',headerName:'52W High',valueFormatter:p=>pct(p.value)},
  {field:'volume_ratio',headerName:'거래량 배수',valueFormatter:p=>p.value==null?'—':Number(p.value).toFixed(2)+'x'},
  {field:'rsi14',headerName:'RSI'},
  {field:'atr_multiple',headerName:'ATR배수',valueFormatter:p=>p.value==null?'—':Number(p.value).toFixed(1)+'x'},
  {field:'sector',headerName:'Sector',minWidth:150},
  {field:'industry',headerName:'Industry',minWidth:160},
  {field:'action_guide',headerName:'액션 가이드',minWidth:260}
]

const watchCols:ColDef<EditableRow>[]=[
  {field:'market',headerName:'시장',editable:false,width:80,flex:0},{field:'ticker',headerName:'Ticker',editable:false,pinned:'left',width:95,flex:0},
  {field:'name',headerName:'종목명',editable:false,minWidth:140},{field:'stage',headerName:'단계',editable:false,minWidth:145},
  {field:'rs_rank',headerName:'RS순위',editable:false},{field:'interest_price',headerName:'관심가'},{field:'stop_pct',headerName:'손절 %'},
  {field:'priority',headerName:'우선순위'},{field:'note',headerName:'메모',minWidth:260}
]
const portfolioCols:ColDef<EditableRow>[]=[
  {field:'market',headerName:'시장',width:80,flex:0},{field:'ticker',headerName:'Ticker',pinned:'left',width:95,flex:0},
  {field:'name',headerName:'종목명',minWidth:140},{field:'account',headerName:'계좌'},{field:'shares',headerName:'수량'},
  {field:'avg_price',headerName:'평단'},{field:'current_price',headerName:'현재가'},{field:'stop_price',headerName:'Stop'},
  {field:'thesis',headerName:'투자 가설',minWidth:300}
]
const researchCols:ColDef<EditableRow>[]=[
  {field:'date',headerName:'작성일'},{field:'type',headerName:'구분'},{field:'target',headerName:'대상'},
  {field:'title',headerName:'제목',minWidth:200},{field:'fact',headerName:'핵심 사실',minWidth:280},
  {field:'interpretation',headerName:'내 해석',minWidth:280},{field:'source',headerName:'출처',minWidth:180},
  {field:'importance',headerName:'중요도'},{field:'status',headerName:'상태'}
]
const journalCols:ColDef<EditableRow>[]=[
  {field:'date',headerName:'날짜'},{field:'account',headerName:'계좌'},{field:'ticker',headerName:'Ticker'},
  {field:'name',headerName:'종목명'},{field:'buy_price',headerName:'매수가'},{field:'thesis',headerName:'매수 이유(가설)',minWidth:300},
  {field:'confidence',headerName:'확신도'},{field:'target_price',headerName:'목표가'},
  {field:'stop_price',headerName:'손절가'},{field:'status',headerName:'상태'}
]

function Kpi({label,value,sub}:{label:string;value:string|number;sub?:string}){
  return <div className="kpi"><span>{label}</span><strong>{value}</strong>{sub&&<small>{sub}</small>}</div>
}

export default function App(){
  const [page,setPage]=useState('dashboard')
  const [leaders,setLeaders]=useState<LeaderRow[]>([])
  const [source,setSource]=useState<'demo'|'supabase'>('demo')
  const [market,setMarket]=useState<'ALL'|Market>('ALL')
  const [query,setQuery]=useState('')
  const [selected,setSelected]=useState<LeaderRow|null>(null)
  const [watch,setWatch]=useLocalRows<EditableRow>('peppercorn-watchlist',initialWatchlist)
  const [portfolio,setPortfolio]=useLocalRows<EditableRow>('peppercorn-portfolio',initialPortfolio)
  const [research,setResearch]=useLocalRows<EditableRow>('peppercorn-research',initialResearch)
  const [journal,setJournal]=useLocalRows<EditableRow>('peppercorn-journal',initialJournal)

  useEffect(()=>{loadLeaderboard().then(r=>{setLeaders(r.rows);setSource(r.source);setSelected(r.rows[0]??null)})},[])

  const filtered=useMemo(()=>leaders.filter(r=>{
    const marketOk=market==='ALL'||r.market===market
    const q=query.trim().toLowerCase()
    return marketOk&&(!q||(r.ticker+' '+r.name+' '+r.sector+' '+r.industry).toLowerCase().includes(q))
  }),[leaders,market,query])

  const leadCount=filtered.filter(r=>r.verdict==='1. 주도').length
  const turnCount=filtered.filter(r=>r.verdict==='2. 강세 전환').length
  const avgRank=filtered.length?Math.round(filtered.reduce((a,r)=>a+(r.rs_rank??0),0)/filtered.length):0
  const breadth=filtered.length?filtered.filter(r=>r.price&&r.ma50&&r.price>r.ma50).length/filtered.length:0

  const filters=<div className="toolbar">
    <div className="segment">{(['ALL','KR','US'] as const).map(m=><button key={m} className={market===m?'on':''} onClick={()=>setMarket(m)}>{m==='ALL'?'전체':m}</button>)}</div>
    <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Ticker · 종목 · Sector 검색"/>
  </div>

  let content
  if(page==='dashboard'){
    const top=filtered.slice().sort((a,b)=>(b.rs_rank??0)-(a.rs_rank??0)).slice(0,8)
    content=<>{filters}
      <section className="kpis">
        <Kpi label="1. 주도주" value={leadCount} sub={'/ '+filtered.length+' 종목'}/>
        <Kpi label="2. 강세 전환" value={turnCount} sub="Next Leader 포함"/>
        <Kpi label="MA50 위 비율" value={(breadth*100).toFixed(0)+'%'} sub="시장 참여도"/>
        <Kpi label="RS순위 평균" value={avgRank} sub="현재 필터 기준"/>
      </section>
      <section className="panel">
        <div className="panel-head"><div><h2>Leadership Snapshot</h2><p>RS순위 · 모멘텀 단계 · 추세를 한 화면에서 확인</p></div><button onClick={()=>setPage('leaderboard')}>전체 보기 →</button></div>
        <GridTable rows={top} columns={leaderCols.slice(0,12)} height={420}/>
      </section>
      <section className="split">
        <div className="panel"><h2>Workflow</h2><div className="flow"><b>Universe</b><i>→</i><b>Python Engine</b><i>→</i><b>Supabase</b><i>→</i><b>Leaderboard</b><i>→</i><b>Portfolio</b></div></div>
        <div className="panel"><h2>Decision Order</h2><p className="note">주도력 → 매수 가능성 → 리스크 순서로 판단합니다. 강한 종목과 지금 살 수 있는 종목을 분리합니다.</p></div>
      </section>
    </>
  }else if(page==='leaderboard'){
    content=<><div className="page-note"><b>자동 계산 영역</b><span>RS · MA · ATR · 52W · Stage는 Python Engine이 계산합니다.</span></div>{filters}<div className="panel"><GridTable rows={filtered} columns={leaderCols} height={650}/></div></>
  }else if(page==='watchlist'){
    content=<><div className="page-note"><b>직접 편집 가능</b><span>관심가 · 손절 · 우선순위 · 메모를 셀에서 수정합니다.</span></div><div className="panel"><GridTable rows={watch} columns={watchCols} editable onChange={setWatch} height={650}/></div></>
  }else if(page==='portfolio'){
    content=<><div className="page-note"><b>Portfolio Workspace</b><span>수량 · 평단 · Stop · 투자 가설을 직접 관리합니다.</span></div><div className="panel"><GridTable rows={portfolio} columns={portfolioCols} editable onChange={setPortfolio} height={650}/></div></>
  }else if(page==='analysis'){
    content=<div className="analysis-layout">
      <div className="panel stock-list"><h2>종목 선택</h2>{filtered.map(r=><button key={r.id} className={selected?.id===r.id?'on':''} onClick={()=>setSelected(r)}><b>{r.ticker}</b><span>{r.name}</span><em>{r.stage}</em></button>)}</div>
      <div className="panel analysis-card">{selected?<>
        <div className="stock-title"><div><span>{selected.market} · {selected.sector}</span><h2>{selected.name} <small>{selected.ticker}</small></h2></div><strong>{selected.verdict}</strong></div>
        <div className="metric-grid">
          <Kpi label="현재가" value={num(selected.price)}/><Kpi label="RS순위" value={selected.rs_rank??'—'}/>
          <Kpi label="RS 1W" value={pct(selected.rs_1w)}/><Kpi label="RS 1M" value={pct(selected.rs_1m)}/>
          <Kpi label="52W High" value={pct(selected.high_52w_distance)}/><Kpi label="거래량" value={(selected.volume_ratio??0).toFixed(2)+'x'}/>
          <Kpi label="RSI(14)" value={selected.rsi14??'—'}/><Kpi label="ATR배수" value={(selected.atr_multiple??0).toFixed(1)+'x'}/>
        </div>
        <div className="checklist"><h3>매수 전 체크</h3>
          <label><span>Trend Template</span><b>{selected.leader_tt?'PASS':'CHECK'}</b></label>
          <label><span>Price &gt; MA50 &gt; MA200</span><b>{selected.price&&selected.ma50&&selected.ma200&&selected.price>selected.ma50&&selected.ma50>selected.ma200?'PASS':'CHECK'}</b></label>
          <label><span>RS순위 ≥ 70</span><b>{(selected.rs_rank??0)>=70?'PASS':'CHECK'}</b></label>
          <label><span>52주 고점 -25% 이내</span><b>{(selected.high_52w_distance??-1)>=-.25?'PASS':'CHECK'}</b></label>
        </div>
        <div className="action-box"><span>액션 가이드</span><strong>{selected.action_guide}</strong></div>
      </>:<p>종목을 선택하세요.</p>}</div>
    </div>
  }else if(page==='research'){
    content=<><div className="page-note"><b>Research Notes</b><span>팩트와 해석을 분리해 기록합니다.</span></div><div className="panel"><GridTable rows={research} columns={researchCols} editable onChange={setResearch} height={650}/></div></>
  }else if(page==='journal'){
    content=<><div className="page-note"><b>Trading Journal</b><span>매수 가설 · 목표 · Stop · 결과 복기를 관리합니다.</span></div><div className="panel"><GridTable rows={journal} columns={journalCols} editable onChange={setJournal} height={650}/></div></>
  }else if(page==='universe'){
    const cols:ColDef<LeaderRow>[]=[
      {field:'market',headerName:'시장'},{field:'asset_class',headerName:'Asset'},
      {field:'ticker',headerName:'Ticker',pinned:'left'},{field:'name',headerName:'종목명',pinned:'left',minWidth:160},
      {field:'sector',headerName:'Sector',minWidth:170},{field:'industry',headerName:'Industry',minWidth:180}
    ]
    content=<><div className="page-note"><b>Universe</b><span>Supabase instruments 테이블이 단일 원본이 됩니다.</span></div>{filters}<div className="panel"><GridTable rows={filtered} columns={cols} height={650}/></div></>
  }else{
    content=<div className="settings-grid">
      <div className="panel"><h2>Analysis Thresholds</h2>
        <div className="setting"><span>Leader RS Rank</span><b>≥ 70</b></div>
        <div className="setting"><span>Leader 52W High</span><b>≥ -25%</b></div>
        <div className="setting"><span>Breakout Zone</span><b>≥ -5%</b></div>
        <div className="setting"><span>Breakout Volume</span><b>≥ 1.4x</b></div>
        <div className="setting"><span>Max Stop</span><b>8%</b></div>
        <div className="setting"><span>Next Leader 52W High</span><b>≥ -30%</b></div>
      </div>
      <div className="panel"><h2>Connection</h2><p className="note">Supabase URL과 Publishable Key를 배포 환경변수로 설정하면 Demo에서 Live로 전환됩니다.</p><code>VITE_SUPABASE_URL<br/>VITE_SUPABASE_PUBLISHABLE_KEY</code></div>
    </div>
  }

  return <div className="shell"><Sidebar page={page} setPage={setPage}/><main>
    <header className="topbar"><div><h1>{page==='dashboard'?'Investment Dashboard':page}</h1><p>Theme → ETF → Stock · Leadership & Risk Workspace</p></div><div className="top-actions"><span className={'source '+source}>{source==='supabase'?'● Supabase Live':'○ Demo / Local'}</span><button onClick={()=>setPage('settings')}>환경 설정</button></div></header>
    <div className="content">{content}</div>
  </main></div>
}
