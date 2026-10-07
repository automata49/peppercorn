import type {Market} from '../types'
import type {MarketSize,StockSize} from '../lib/stockSize'
export function StockSizeFilter({value,onChange,market,sizes}:{value:StockSize;onChange:(v:StockSize)=>void;market:Market|'ALL';sizes:Record<Market,MarketSize>}){
 const markets:readonly Market[]=market==='ALL'?['KR','US']:[market]
 return <div className="stock-size-filter">
  <div className="mini-segment stock-size-tabs" role="group" aria-label="종목 규모">{([['large','대형주'],['small','중소형주'],['all','전체 규모']] as const).map(([key,label])=><button type="button" key={key} aria-pressed={value===key} className={value===key?'on':''} onClick={()=>onChange(key)}>{label}</button>)}</div>
  <details className="stock-size-basis"><summary>규모 기준 · {markets.map(m=>{const s=sizes[m];return m+': '+(s.basis==='market_cap'?'시가총액':s.basis==='traded_value_20d'?'20일 평균 거래대금 (시가총액 대체)':'규모 데이터 없음')}).join(' · ')}</summary><p>시장별 상위 10% 기준은 대형주, 나머지는 중소형주로 표시합니다. 동률 포함 · 규모 미확인 {markets.reduce((n,m)=>n+sizes[m].unknown,0)}종목은 전체 규모에서 확인하세요.</p></details>
 </div>
}
