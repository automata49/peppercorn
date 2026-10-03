import type { History } from './priceHistory'

// PRICE-RS-1 (display only): the stock detail's combined chart from daily closes (`price-history`).
// Top: stock and benchmark closes rebased to 100 at the close `sessions` ago (same base as the period return).
// Bottom: RS line = stock close / benchmark close on the same date, rebased to 100 at the same start.
// RS new high = the RS line above every earlier value in the loaded history (≤252 sessions ≈ 52W).
export const PRICE_RS_VERSION='PRICE-RS-1'
export const BENCHMARK:Record<string,string>={US:'SPY',KR:'226490'}

export type PriceRsData={
  dates:string[]
  price:number[]
  bench:(number|null)[]|null
  rs:(number|null)[]|null
  rsHigh:boolean[]
  priceHigh:number
  belowPriceHigh:boolean
  historySessions:number
  complete:boolean
}

export function priceRs(stock:History|undefined,bench:History|undefined,sessions:number):PriceRsData|null{
  if(!stock||stock.closes.length<2)return null
  const n=Math.min(sessions+1,stock.closes.length),start=stock.closes.length-n
  const base=stock.closes[start];if(!(base>0))return null
  const dates=stock.dates.slice(start),price=stock.closes.slice(start).map(c=>c/base*100)
  const b=bench&&bench.closes.length?new Map(bench.dates.map((d,i)=>[d,bench.closes[i]])):null
  // Ratio over the whole loaded history, so new highs are judged against the full window, not just the period shown.
  const ratio=b?stock.dates.map((d,i)=>{const v=b.get(d);return v&&v>0&&stock.closes[i]>0?stock.closes[i]/v:null}):null
  const rsHigh=dates.map(()=>false)
  let benchSeries:(number|null)[]|null=null,rs:(number|null)[]|null=null
  if(b&&ratio){
    const bBase=b.get(dates[0]),rBase=ratio[start]
    if(bBase&&bBase>0)benchSeries=dates.map(d=>{const v=b.get(d);return v&&v>0?v/bBase*100:null})
    if(rBase!=null){
      rs=ratio.slice(start).map(v=>v==null?null:v/rBase*100)
      let max=-Infinity
      ratio.forEach((v,i)=>{if(v==null)return;if(i>=start&&i>0&&v>max*(1+1e-9))rsHigh[i-start]=true;if(v>max)max=v})
    }
  }
  const fullHigh=Math.max(...stock.closes),last=stock.closes[stock.closes.length-1]
  return {dates,price,bench:benchSeries,rs,rsHigh,priceHigh:Math.max(...price),belowPriceHigh:last<fullHigh,historySessions:stock.closes.length-1,complete:stock.closes.length>=sessions+1}
}
