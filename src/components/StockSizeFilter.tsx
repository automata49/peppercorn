import type {Market} from '../types'
import type {MarketSize,StockSize} from '../lib/stockSize'
export const STOCK_CATEGORY_LABELS=[['large','대형주'],['small','중소형주'],['all','전체'],['etf','ETF']] as const
export function StockSizeFilter({value,onChange,market,sizes}:{value:StockSize;onChange:(v:StockSize)=>void;market:Market|'ALL';sizes:Record<Market,MarketSize>}){
 const markets:readonly Market[]=market==='ALL'?['KR','US']:[market]
 const basis=markets.map(m=>{const s=sizes[m];return m+': '+(s.basis==='market_cap'?'시가총액':s.basis==='traded_value_20d'?'20일 평균 거래대금 (시가총액 대체)':'규모 데이터 없음')}).join(' · ')
 const detail=value==='etf'?'ETF는 대형주/중소형주 구분 없이 같은 시장 ETF끼리 RS 순위로 표시합니다.':value==='all'?'대형주·중소형주와 ETF를 함께 표시합니다.':'시장별 상위 10% 기준은 대형주, 나머지는 중소형주입니다. 시가총액 데이터가 충분하지 않으면 20일 평균 거래대금을 대체 기준으로 사용합니다. 규모 미확인 '+markets.reduce((n,m)=>n+sizes[m].unknown,0)+'종목은 전체에서 확인하세요.'
 return <div className="stock-size-filter">
  <div className="stock-size-tabs" role="group" aria-label="분류">
   <div className="stock-size-equities">{STOCK_CATEGORY_LABELS.slice(0,3).map(([key,label])=><button type="button" key={key} aria-pressed={value===key} className={value===key?'on':''} onClick={()=>onChange(key)}>{label}</button>)}</div>
   <span className="stock-size-divider" aria-hidden="true">/</span>
   <button type="button" className={'stock-size-etf'+(value==='etf'?' on':'')} aria-pressed={value==='etf'} onClick={()=>onChange('etf')}>ETF</button>
  </div>
  <details className="stock-size-basis"><summary>{value==='etf'?'ETF · 주식 규모 분류와 별도':value==='all'?'전체 · 주식 + ETF':'규모 기준 · '+basis}</summary><p>{detail}</p></details>
 </div>
}
