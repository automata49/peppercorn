import { useEffect, useState } from 'react'

// POSITION-READ-1: 종목 분석 › Position shows the latest stored Position snapshot and fact coverage.
// Labels appear only when the stored snapshot is `ok` (every data check passed and an active rule set exists);
// until then all four stay hidden with the reason. Metrics are the collector's deterministic values, never a score.
const POSITION_URL='https://mhbcchegrbakearqptdr.supabase.co/functions/v1/position-read?client=peppercorn-public-read-v1'

type Check=[string,boolean,string?]
type Snapshot={as_of:string;status:'ok'|'check_failed'|'insufficient_data'|'unavailable';rules_version:string;fcf_method:string;roic_method:string;
  checks:Check[];metrics:Record<string,unknown>;type_label:string|null;quality_label:string|null;growth_label:string|null;value_label:string|null;
  label_reasons:Record<string,string>;pipeline_version:string;computed_at:string}
type Facts={reported:number;unknown:number;first_period:string|null;last_period:string|null;latest_filed:string|null;sources:string[];collected_at:string|null}
type Body={ok:boolean;instrument:boolean;snapshot:Snapshot|null;facts:Facts|null}
type State={kind:'loading'}|{kind:'error'}|{kind:'ready';body:Body}

const day=(v:string|null|undefined)=>v?String(v).slice(0,10):'—'
const finite=(v:unknown)=>v!=null&&v!==''&&Number.isFinite(Number(v))
const pct=(v:unknown)=>finite(v)?`${Number(v)>0?'+':''}${(Number(v)*100).toFixed(1)}%`:'—'
function money(v:unknown,market:string){
  if(!finite(v))return '—'
  const n=Number(v),a=Math.abs(n),sign=n<0?'-':''
  if(market==='KR')return a>=1e12?`${sign}${(a/1e12).toFixed(1)}조원`:`${sign}${Math.round(a/1e8).toLocaleString('ko-KR')}억원`
  return a>=1e9?`${sign}$${(a/1e9).toFixed(1)}B`:`${sign}$${(a/1e6).toFixed(0)}M`
}

const statusText:Record<Snapshot['status'],[string,string]>={
  ok:['검증 통과','green'],
  unavailable:['라벨 비활성','amber'],
  check_failed:['데이터 점검 실패','red'],
  insufficient_data:['데이터 부족','gray']
}
const labelSlots=[['type','Type','사업 유형'],['quality','Quality','수익성·자본효율'],['growth','Growth','성장 지속성'],['value','Value','가격이 요구하는 성장']] as const

export function PositionPanel({market,ticker,name}:{market:string;ticker:string;name:string}){
  const [state,setState]=useState<State>({kind:'loading'})
  const [attempt,setAttempt]=useState(0)
  useEffect(()=>{
    const controller=new AbortController()
    setState({kind:'loading'})
    fetch(`${POSITION_URL}&market=${encodeURIComponent(market)}&ticker=${encodeURIComponent(ticker)}`,{signal:AbortSignal.any?AbortSignal.any([controller.signal,AbortSignal.timeout(12_000)]):controller.signal})
      .then(r=>r.ok?r.json():Promise.reject(new Error(String(r.status))))
      .then((body:Body)=>setState({kind:'ready',body}))
      .catch(()=>{if(!controller.signal.aborted)setState({kind:'error'})})
    return()=>controller.abort()
  },[market,ticker,attempt])

  if(state.kind==='loading')return <div className="position-panel" aria-busy="true"><p className="position-note">Position 데이터를 불러오는 중…</p></div>
  if(state.kind==='error')return <div className="position-panel"><div className="position-empty"><b>Position 데이터를 불러오지 못했습니다.</b><span>연결 상태를 확인한 뒤 다시 시도하세요.</span><button type="button" className="text-button" onClick={()=>setAttempt(a=>a+1)}>다시 시도</button></div></div>
  const {snapshot,facts}=state.body
  if(!snapshot)return <div className="position-panel"><div className="position-empty"><b>{name}은(는) 아직 Position 수집 대상이 아닙니다.</b><span>재무제표 사실(SEC·DART)과 점검을 통과한 스냅샷이 쌓인 종목만 표시합니다. 현재 수집 대상: NVIDIA, 삼성전자.</span></div></div>

  const m=snapshot.metrics||{}
  const [statusLabel,statusTone]=statusText[snapshot.status]??['상태 확인','gray']
  const checks=Array.isArray(snapshot.checks)?snapshot.checks:[]
  const failed=checks.filter(c=>c[1]!==true)
  const labelled=snapshot.status==='ok'
  const reason=snapshot.status==='check_failed'?'데이터 점검 실패로 네 라벨을 모두 숨깁니다.'
    :snapshot.status==='unavailable'?'사전 검증을 통과한 규칙 버전이 아직 없어 라벨을 표시하지 않습니다.'
    :snapshot.status==='insufficient_data'?'판단에 필요한 기간·항목이 부족해 라벨을 표시하지 않습니다.':''
  const groups:[string,string,[string,string][]][]=[
    ['quality','Quality · 수익성과 자본효율',[['ROIC',pct(m.roic)],['증분 ROIC',pct(m.incremental_roic)],['ROE',pct(m.roe)],['영업이익률',pct(m.operating_margin)],['매출총이익률',pct(m.gross_margin)],['FCF 마진',pct(m.fcf_margin)],['FCF 전환율',pct(m.fcf_conversion)]]],
    ['growth','Growth · 성장',[['매출 YoY',pct(m.revenue_yoy)],['매출 3Y CAGR',pct(m.revenue_cagr_3y)],['순이익 3Y CAGR',pct(m.net_income_cagr_3y)],['주식 수 YoY',pct(m.dilution_yoy)]]],
    ['scale','규모 · TTM',[['매출',money(m.ttm_revenue,market)],['영업이익',money(m.ttm_operating_income,market)],['순이익',money(m.ttm_net_income,market)],['FCF',money(m.ttm_fcf,market)],['FCF − SBC (프록시)',money(m.owner_earnings,market)],['순부채',money(m.net_debt,market)]]]
  ]
  return <div className="position-panel">
    <div className="position-head">
      <div><span className="position-kicker">Position Growth · 스윙과 독립</span><h3>{day(snapshot.as_of)} 분기 기준</h3></div>
      <span className={'pill '+statusTone}>{statusLabel}</span>
    </div>
    <div className="position-labels" role="list" aria-label="Position 라벨">
      {labelSlots.map(([key,title,sub])=>{
        const value=labelled?(snapshot as any)[key+'_label']:null
        return <div key={key} className={'position-label'+(value?'':' off')} role="listitem"><span>{title}</span><strong>{value||'—'}</strong><small>{value?(snapshot.label_reasons?.[key]||sub):sub}</small></div>
      })}
    </div>
    {!labelled&&<p className="position-note">{reason} 아래 수치는 공시 사실로 계산한 값이며 매수·매도 판단이 아닙니다.</p>}
    {groups.map(([key,title,items])=><section key={key} className="position-group">
      <h4>{title}</h4>
      <div className="position-metrics">{items.map(([label,value])=><div key={label} className="position-metric"><span>{label}</span><strong>{value}</strong></div>)}</div>
    </section>)}
    <section className="position-group">
      <h4>데이터 점검 · 출처</h4>
      <div className="position-meta">
        <span>점검 <b>{checks.length-failed.length}/{checks.length}</b> 통과{failed.length?` · 실패: ${failed.map(c=>c[0]).join(', ')}`:''}</span>
        {facts&&<span>공시 사실 <b>{facts.reported}</b>건 · 미확인 {facts.unknown}건 · {day(facts.first_period)} ~ {day(facts.last_period)} · 최근 공시 {day(facts.latest_filed)} · {facts.sources.join('·')||'—'}</span>}
        <span>규칙 {snapshot.rules_version} · FCF {snapshot.fcf_method} · ROIC {snapshot.roic_method}{m.roic_lease_basis?` (${String(m.roic_lease_basis)})`:''}</span>
        <span>계산 {day(snapshot.computed_at)} · 파이프라인 {snapshot.pipeline_version}</span>
      </div>
    </section>
  </div>
}
