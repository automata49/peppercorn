import type {LeaderRow} from '../types'
export function NewsStockMetrics({row}:{row:LeaderRow}){
 const value=row.return_20d,valid=value!=null&&Number.isFinite(value)
 return <div className="news-stock-metrics" data-market={row.market} aria-label="연결 종목 20거래일 등락률"><span>{row.market==='KR'?row.name:row.ticker} · {row.asset_class==='ETF'?'ETF':String(row.stage).includes('조정 중')?'조정 중':row.leadership_class||'연결 종목'}</span><b className={valid&&value>0?'positive':valid&&value<0?'negative':''}>20D {valid?(value>0?'+':'')+(value*100).toFixed(1)+'%':'—'}</b><small>종목 데이터 · 기사 시점과 다를 수 있음</small></div>
}
