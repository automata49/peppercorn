import { AnimatedNumber } from './motion/AnimatedNumber'
import { useState } from 'react'
import type { LeaderRow } from '../types'
import { usePriceHistory } from '../lib/priceHistory'

const percent=(n:number|null|undefined)=>n==null||!Number.isFinite(n)?'—':`${n>=0?'+':''}${(n*100).toFixed(1)}%`
type HeroPeriod='1D'|'1W'|'1M'|'3M'|'1Y'|'ALL'
const periods:HeroPeriod[]=['1D','1W','1M','3M','1Y','ALL']
const sessions:Record<HeroPeriod,number>={'1D':1,'1W':5,'1M':20,'3M':60,'1Y':252,'ALL':9999}

export function LeaderSpotlight({rows,onSelect,labelFor}:{rows:LeaderRow[];labelFor:(row:LeaderRow)=>string;onSelect:(row:LeaderRow)=>void}){
  const [selectedId,setSelectedId]=useState('')
  const [period,setPeriod]=useState<HeroPeriod>('1M')
  const row=rows.find(r=>r.id===selectedId)||rows[0]
  const history=usePriceHistory(row?[row.id]:[],!!row)
  const [exploration,setExploration]=useState<{id:string;index:number}|null>(null)
  if(!row)return <div className="spotlight-empty">조건을 통과한 리더가 없습니다. 전체 후보에서 시장을 살펴보세요.</div>

  const h=history.get(row.id)
  const allPoints=h?h.closes.map((close,i)=>({close,date:h.dates[i]})).filter(p=>Number.isFinite(p.close)&&p.close>0&&p.date).slice(-253):[]
  const wanted=sessions[period]+1
  const points=allPoints.slice(-Math.min(allPoints.length,wanted))
  const cursor=exploration?.id===row.id?Math.min(exploration.index,Math.max(0,points.length-1)):Math.max(0,points.length-1)
  const point=points[cursor]
  const lo=points.length?Math.min(...points.map(p=>p.close)):0
  const hi=points.length?Math.max(...points.map(p=>p.close)):1
  const range=hi-lo||1
  const x=(i:number)=>12+i/Math.max(1,points.length-1)*616
  const y=(close:number)=>174-(close-lo)/range*142
  const path=points.map((p,i)=>`${i?'L':'M'}${x(i)},${y(p.close)}`).join(' ')
  const chartChange=points.length>1?points[points.length-1].close/points[0].close-1:null
  const tone=(chartChange??row.return_50d??0)<0?'falling':'rising'
  const setHeroPeriod=(next:HeroPeriod)=>{setPeriod(next);setExploration(null)}

  return <div className="leader-spotlight" aria-label="리더 집중 탐색">
    <div key={row.id} className="spotlight-body" id="spotlight-panel" role="tabpanel">
      <div className="spotlight-kicker">TODAY'S LEADER</div>
      <div className="spotlight-identity"><span>{row.market} · {row.group_name||row.industry||row.sector}</span><span>{labelFor(row)}</span></div>
      <h3>{row.name||row.ticker}</h3>
      <div className="spotlight-price">
        <strong><AnimatedNumber value={(point?.close??row.price)?.toLocaleString('ko-KR',{maximumFractionDigits:2})??'—'}/></strong>
        <span>{row.market==='KR'?'KRW':'USD'} · {point?.date||'일간 종가'}</span>
      </div>
      <div className="spotlight-performance"><b className={tone}>{percent(chartChange)}</b><span>{period} 표시 구간</span></div>

      <div className={'spotlight-chart '+tone}>
        {points.length>1?<>
          <svg viewBox="0 0 640 204" role="img" aria-label={`${row.name} ${period} 일간 종가`} onPointerMove={e=>{if(e.pointerType==='touch'&&e.buttons===0)return;const rect=e.currentTarget.getBoundingClientRect();setExploration({id:row.id,index:Math.round(Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width))*(points.length-1))})}} onPointerLeave={()=>setExploration(null)}>
            <defs>
              <linearGradient id="spotlight-line-gradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#54265f"/><stop offset="38%" stopColor="#a34f78"/><stop offset="72%" stopColor="#f06a45"/><stop offset="100%" stopColor="#f5a24a"/>
              </linearGradient>
              <linearGradient id="spotlight-area-gradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#54265f" stopOpacity=".04"/><stop offset="45%" stopColor="#a34f78" stopOpacity=".12"/><stop offset="100%" stopColor="#f5a24a" stopOpacity=".22"/>
              </linearGradient>
            </defs>
            <path className="spotlight-area" d={path+' L628,202 L12,202 Z'} fill="url(#spotlight-area-gradient)"/>
            <path className="spotlight-line" d={path} stroke="url(#spotlight-line-gradient)"/>
            {point&&<><line className="spotlight-cursor" x1={x(cursor)} x2={x(cursor)} y1="12" y2="190"/><circle cx={x(cursor)} cy={y(point.close)} r="5"/></>}
          </svg>
          <input className="spotlight-slider" type="range" min={0} max={Math.max(0,points.length-1)} value={cursor} aria-label="리더 차트 날짜 탐색" aria-valuetext={point?`${point.date} 종가 ${point.close}`:'가격 이력 없음'} onChange={e=>setExploration({id:row.id,index:Number(e.target.value)})}/>
        </>:<p className="spotlight-chart-empty">{history.status==='loading'?'가격 흐름을 불러오는 중':'가격 이력이 없습니다. 종가와 RS를 확인하세요.'}</p>}
      </div>

      <div className="spotlight-periods" role="tablist" aria-label="차트 기간">
        {periods.map(p=><button key={p} type="button" role="tab" aria-selected={period===p} className={period===p?'on':''} onClick={()=>setHeroPeriod(p)}>{p}</button>)}
      </div>

      <div className="spotlight-tabs" role="tablist" aria-label="대표 리더 선택">
        {rows.map((r,i)=><button key={r.id} type="button" role="tab" aria-selected={r.id===row.id} tabIndex={r.id===row.id?0:-1} onKeyDown={e=>{const next=e.key==='ArrowRight'?(i+1)%rows.length:e.key==='ArrowLeft'?(i-1+rows.length)%rows.length:e.key==='Home'?0:e.key==='End'?rows.length-1:null;if(next!=null){e.preventDefault();const parent=e.currentTarget.parentElement;setSelectedId(rows[next].id);setExploration(null);window.requestAnimationFrame(()=>parent?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus())}}} onClick={()=>{setSelectedId(r.id);setExploration(null)}}>{r.ticker}<small>{r.market}</small></button>)}
      </div>

      <div className="spotlight-evidence">
        <div><span>RS 순위</span><b>{row.rs_rank==null?'—':Math.round(row.rs_rank)}</b></div>
        <div><span>업종 순위</span><b>{row.group_rank!=null&&row.group_total?`${row.group_rank} / ${row.group_total}`:'—'}</b></div>
        <div><span>52W 고점 대비</span><b>{percent(row.high_52w_distance)}</b></div>
      </div>
      <button type="button" className="spotlight-open" aria-label="이 종목 깊이 보기" onClick={()=>onSelect(row)}>종목 분석 <span aria-hidden="true">↗</span></button>
    </div>
  </div>
}
