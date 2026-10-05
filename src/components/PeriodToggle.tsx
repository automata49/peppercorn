import { RS_CHART_PERIODS, type RsChartPeriod } from '../lib/rsChart'
export function PeriodToggle({label,period,onPeriod}:{label:string;period:RsChartPeriod;onPeriod:(p:RsChartPeriod)=>void}){
  return <div className="mini-segment rs-period-toggle" role="group" aria-label={`${label} 기간`}>{RS_CHART_PERIODS.map(([p])=><button key={p} type="button" className={period===p?'on':''} aria-pressed={period===p} onClick={()=>onPeriod(p)}>{p}</button>)}</div>
}

