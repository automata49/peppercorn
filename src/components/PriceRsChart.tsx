import { CHART_SESSIONS } from '../lib/rsChart'
import type { LeaderRow } from '../types'
import { useElementWidth } from '../lib/useElementWidth'
import { usePriceHistory } from '../lib/priceHistory'
import { PeriodToggle } from './PeriodToggle'
import { lazy, Suspense, memo, useMemo, useState } from 'react'
import { Button } from './ui/button'
const ClosePriceChart=lazy(()=>import('./ClosePriceChart'))
import { BENCHMARK, PRICE_RS_VERSION, priceRs, type PriceRsData } from '../lib/benchmarkChart'
import { yScale, type RsChartPeriod } from '../lib/rsChart'
import { AnimatedNumber } from './motion/AnimatedNumber'
const pct=(n:number|null)=>n==null?'—':`${n>=0?'+':''}${(n*100).toFixed(1)}%`
export const PRICE_C='var(--folio-ink)',BENCH_C='var(--folio-muted)',RS_C='var(--folio-magenta)'

export function PriceRsSvg({data,width,benchTicker}:{data:PriceRsData;width:number;benchTicker:string}){
  const narrow=width<520,n=data.dates.length
  const [scrub,setScrub]=useState<number|null>(null)
  const L=46,R=52,w=Math.max(0,width-L-R),T1=24,H1=narrow?170:190,G=40,T2=T1+H1+G,H2=data.rs?(narrow?64:76):0,B=24,H=(data.rs?T2+H2:T1+H1)+B
  const x=(i:number)=>L+(n>1?i*w/(n-1):0)
  const top=yScale([{key:'p',label:'',values:data.price},{key:'b',label:'',values:data.bench??[]}],100)
  const y1=(v:number)=>T1+(top.hi-v)/(top.hi-top.lo)*H1
  const bot=data.rs?yScale([{key:'r',label:'',values:data.rs}],100):null
  const y2=(v:number)=>T2+(bot!.hi-v)/(bot!.hi-bot!.lo)*H2
  const path=(values:(number|null)[],y:(v:number)=>number)=>{let d='',pen=false;values.forEach((v,i)=>{if(v==null){pen=false;return}d+=`${pen?'L':'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`;pen=true});return d}
  const end=(values:(number|null)[],y:(v:number)=>number,c:string,label:string,hl:boolean)=>{const i=values.length-1,v=values[i];if(v==null)return null
    return <g><circle cx={x(i)} cy={y(v)} r={hl?4:3.2} className="line-dot" stroke={c} strokeWidth={hl?2:1.6}><title>{`${label} · ${data.dates[i]} ${v.toFixed(1)} (${pct(v/100-1)})`}</title></circle><text x={x(i)+8} y={y(v)+3.5} className="price-rs-end" fill={c}>{v.toFixed(1)}</text></g>}
  const gap=data.bench&&data.bench.every(v=>v!=null)?path(data.price,y1)+data.bench.map((v,k)=>{const i=n-1-k;return `L${x(i).toFixed(1)} ${y1(data.bench![i]!).toFixed(1)}`}).join('')+'Z':''
  const hiIdx=data.price.indexOf(data.priceHigh)
  const xTicks=[...new Set((narrow?[0,1,2,3].map(k=>Math.round(k*(n-1)/3)):[0,1,2,3,4,5].map(k=>Math.round(k*(n-1)/5))))]
  const last=n-1,rsLast=data.rs?.[last]
  const selected=Math.min(scrub??last,last)
  const choose=(clientX:number,element:SVGSVGElement)=>{const rect=element.getBoundingClientRect();setScrub(Math.max(0,Math.min(last,Math.round(((clientX-rect.left)*width/rect.width-L)/Math.max(1,w)*last))))}
  return <><div className="chart-readout" aria-live="off">
    <time>{data.dates[selected]}</time>
    <span>종목 <b><AnimatedNumber value={data.price[selected].toFixed(1)}/></b></span>
    {data.bench&&<span>{benchTicker} <b>{data.bench[selected]?.toFixed(1)??'—'}</b></span>}
    {data.rs&&<span>RS <b>{data.rs[selected]?.toFixed(1)??'—'}</b></span>}
  </div><svg className="scrubbable-chart" width={width} height={H} role="img" aria-label={`가격과 벤치마크${data.rs?', RS 라인':''} 꺾은선 차트`}
    onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);choose(e.clientX,e.currentTarget)}}
    onPointerMove={e=>{if(e.pointerType==='mouse'||e.currentTarget.hasPointerCapture(e.pointerId))choose(e.clientX,e.currentTarget)}}
    onPointerUp={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)}}
    onPointerCancel={()=>setScrub(null)}>
    <text className="line-axis-title" x={4} y={10}>지수 (시작=100)</text>
    {top.ticks.map(t=><g key={t}><line x1={L} x2={L+w} y1={y1(t)} y2={y1(t)} className={t===100?'line-zero':'line-grid'}/><text x={L-6} y={y1(t)+3.5} textAnchor="end" className="line-tick">{t.toFixed(0)}</text></g>)}
    {gap&&<path d={gap} className="price-rs-gap"/>}
    {hiIdx>=0&&hiIdx<last&&<g className="price-rs-high"><line x1={x(hiIdx)} x2={x(last)} y1={y1(data.priceHigh)} y2={y1(data.priceHigh)}/><text x={x(hiIdx)-4} y={y1(data.priceHigh)-6} textAnchor="end" className="line-tick">기간 고점</text></g>}
    {data.bench&&<path d={path(data.bench,y1)} fill="none" stroke={BENCH_C} strokeWidth={1.6} strokeDasharray="5 4" strokeLinejoin="round" className="price-rs-bench" data-key="bench"/>}
    <path d={path(data.price,y1)} fill="none" stroke={PRICE_C} strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" className="line-path" style={{color:PRICE_C}} data-key="price"/>
    {data.bench&&end(data.bench,y1,BENCH_C,benchTicker,false)}
    {end(data.price,y1,PRICE_C,'종가',true)}
    {data.rs&&bot&&<g className="price-rs-panel">
      <line x1={0} x2={width} y1={T2-28} y2={T2-28} className="price-rs-divider"/>
      <text className="line-axis-title" x={4} y={T2-14}>RS 라인 ({benchTicker} 대비)</text>
      {bot.ticks.map(t=><g key={t}><line x1={L} x2={L+w} y1={y2(t)} y2={y2(t)} className={t===100?'line-zero':'line-grid'}/><text x={L-6} y={y2(t)+3.5} textAnchor="end" className="line-tick">{t.toFixed(0)}</text></g>)}
      <path d={path(data.rs,y2)} fill="none" stroke={RS_C} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" className="line-path" style={{color:RS_C}} data-key="rs"/>
      {data.rs.map((v,i)=>v!=null&&data.rsHigh[i]&&i<last?<circle key={i} cx={x(i)} cy={y2(v)} r={2.6} fill={RS_C} className="price-rs-new-high"><title>{`RS 라인 신고가 · ${data.dates[i]}`}</title></circle>:null)}
      {end(data.rs,y2,RS_C,'RS 라인',true)}
      {rsLast!=null&&data.rsHigh[last]&&<circle cx={x(last)} cy={y2(rsLast)} r={2.6} fill={RS_C} className="price-rs-new-high"><title>{`RS 라인 신고가 · ${data.dates[last]}`}</title></circle>}
      {rsLast!=null&&data.rsHigh[last]&&data.belowPriceHigh&&<text x={x(last)-10} y={y2(rsLast)-8} textAnchor="end" className="price-rs-callout">RS 신고가 · 주가는 고점 아래</text>}
    </g>}
    {scrub!=null&&<g className="chart-crosshair" aria-hidden="true">
      <line x1={x(selected)} x2={x(selected)} y1={T1} y2={data.rs?T2+H2:T1+H1}/>
      <circle cx={x(selected)} cy={y1(data.price[selected])} r={4} fill="white" stroke={PRICE_C} strokeWidth={2}/>
      {data.rs?.[selected]!=null&&<circle cx={x(selected)} cy={y2(data.rs[selected]!)} r={3} fill="white" stroke={RS_C} strokeWidth={2}/>}
    </g>}
    {xTicks.map(i=><text key={i} x={x(i)} y={H-6} textAnchor={i===0?'start':i===last?'end':'middle'} className="line-tick">{data.dates[i].slice(5)}</text>)}
  </svg>
    <input className="chart-scrubber" type="range" min={0} max={last} value={selected}
      aria-label="차트 날짜 탐색" aria-valuetext={`${data.dates[selected]} · 종목 지수 ${data.price[selected].toFixed(1)}`}
      onChange={e=>setScrub(Number(e.target.value))}/>
    <p className="chart-scrub-hint">차트를 좌우로 훑어 날짜별 값 확인 · 시작=100</p>
  </>
}


export const PriceRsChart=memo(function PriceRsChart({row,rows}:{row:LeaderRow;rows:LeaderRow[]}){
  const [period,setPeriod]=useState<RsChartPeriod>('50D')
  const [view,setView]=useState<'relative'|'close'>('relative')
  const ticker=BENCHMARK[row.market]
  const isBench=row.ticker===ticker
  const bench=isBench?undefined:rows.find(r=>r.market===row.market&&r.ticker===ticker)
  const hist=usePriceHistory(bench?[row.id,bench.id]:[row.id],true)
  const rawHistory=hist.get(row.id)
  const closeHistory=useMemo(()=>rawHistory?{dates:rawHistory.dates.slice(-CHART_SESSIONS[period]-1),closes:rawHistory.closes.slice(-CHART_SESSIONS[period]-1)}:undefined,[rawHistory,period])
  const data=priceRs(rawHistory,bench&&hist.get(bench.id),CHART_SESSIONS[period])
  const [ref,width]=useElementWidth<HTMLDivElement>()
  return <div data-market={row.market} className="peer-line price-rs" title={PRICE_RS_VERSION}>
    <PeriodToggle label="가격 모멘텀" period={period} onPeriod={setPeriod}/>
    <div className="chart-view-switch" role="group" aria-label="차트 보기"><Button variant="ghost" aria-pressed={view==='relative'} onClick={()=>setView('relative')}>가격 · RS 비교</Button><Button variant="ghost" aria-pressed={view==='close'} onClick={()=>setView('close')}>종가 확대</Button></div>
    {hist.status==='error'?<p className="empty">일별 가격을 불러오지 못했습니다 ({hist.error}).</p>
      :!data?<p className="empty">{hist.status==='loading'||hist.status==='idle'?'일별 가격을 불러오는 중…':'일별 가격 이력이 없습니다.'}</p>
      :<>
        {view==='close'&&closeHistory&&<Suspense fallback={<p>종가 차트 준비 중…</p>}><ClosePriceChart key={row.id+period} history={closeHistory} name={row.name} currency={row.market==='KR'?'KRW':'USD'}/></Suspense>}
        <div hidden={view!=='relative'} ref={ref} className="line-chart-plot">{width>0&&<PriceRsSvg key={row.id+period} data={data} width={width} benchTicker={ticker}/>}</div>
        {view==='relative'&&<>{!data.rs&&<p className="empty price-rs-missing">{isBench?`이 종목이 ${row.market} 벤치마크(${ticker})라 RS 라인이 없습니다.`:!bench?`벤치마크(${ticker}) 가격이 없어 RS 라인을 그릴 수 없습니다.`:'벤치마크와 겹치는 일별 가격이 없어 RS 라인을 그릴 수 없습니다.'}</p>}
        <ul className="line-legend">
          {[{label:row.name,sub:`${row.ticker} · ${CHART_SESSIONS[period]}거래일`,c:PRICE_C,dash:false,v:data.price},
            ...(data.bench?[{label:ticker,sub:`벤치마크${bench?.name&&bench.name!==ticker?' · '+bench.name:''}`,c:BENCH_C,dash:true,v:data.bench}]:[]),
            ...(data.rs?[{label:'RS 라인',sub:`${row.ticker} ÷ ${ticker} · 100 위 = 초과 성과`,c:RS_C,dash:false,v:data.rs}]:[])].map(s=>{
            const end=[...s.v].reverse().find(v=>v!=null),ch=end==null?null:end/100-1
            return <li key={s.label}><span><svg width="18" height="10" aria-hidden="true"><line x1="1" x2="17" y1="5" y2="5" stroke={s.c} strokeWidth="2" strokeDasharray={s.dash?'4 3':undefined}/></svg><b>{s.label}</b><small>{s.sub}</small><em className={ch==null?'':ch>0?'pos':ch<0?'neg':''}>{pct(ch)}</em></span></li>})}
        </ul>
        <p className="rs-chart-note">위: {CHART_SESSIONS[period]}거래일 전 종가=100{data.bench?`, 회색 점선 = 벤치마크(${ticker})`:''}{data.rs?<> · 아래: RS 라인 = 종목 ÷ 벤치마크 (시작=100), 100 위 = 초과 성과 · <b className="price-rs-dot">●</b> = RS 라인 신고가 (불러온 {data.historySessions}거래일 기준)</>:''}{data.complete?'':` · 이력이 짧아 ${data.dates.length-1}거래일만 표시`}</p></>}
      </>}
  </div>
})

