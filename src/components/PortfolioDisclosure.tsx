import type { EditableRow, LeaderRow } from '../types'

export function PortfolioDisclosure({portfolio,leaders,source}:{portfolio:EditableRow[];leaders:LeaderRow[];source:'demo'|'supabase'}){
 const holdings=portfolio.filter(r=>r.shares!=null&&String(r.shares).trim()!==''&&Number.isFinite(Number(r.shares))&&Number(r.shares)>0)
 const money=(n:number,currency:string)=>`${n.toLocaleString('ko-KR',{maximumFractionDigits:2})} ${currency}`
 return <details className="journey-assets"><summary>자산 흐름 펼치기</summary>
  <p>내가 입력한 보유 수량·평단과 시장 일간 종가를 비교합니다. 거래·입출금 시계열이 없어 누적 수익률과 과거 자산 흐름은 표시할 수 없습니다. 통화는 환산하거나 합산하지 않습니다.</p>
  {!holdings.length?<p>보유 수량이 기록된 종목이 없습니다. 관심·보유에서 실제 보유 내역을 입력하세요.</p>:<ul>{holdings.map((r,i)=>{
   const row=leaders.find(l=>l.market===r.market&&l.ticker===r.ticker),currency=String(r.currency||''),quoteCurrency=row?.market==='KR'?'KRW':row?.market==='US'?'USD':''
   const quantity=Number(r.shares),cost=r.avg_price!=null&&String(r.avg_price).trim()!==''&&Number.isFinite(Number(r.avg_price))&&Number(r.avg_price)>0?quantity*Number(r.avg_price):null
   const price=source==='supabase'&&row?.price!=null&&Number.isFinite(row.price)&&row.price>0?row.price:null
   return <li key={String(r.id||i)} data-market={String(r.market)}><h3>{String(r.name||r.ticker)} <small>{String(r.ticker)}</small></h3><p>{quantity.toLocaleString('ko-KR')}주 · 원가 통화 {currency||'미입력'}</p><dl><div><dt>입력 원가</dt><dd>{cost!=null&&currency?money(cost,currency):'평단 또는 원가 통화 입력 필요'}</dd></div><div><dt>종가 기준 평가액</dt><dd>{price!=null&&quoteCurrency?money(quantity*price,quoteCurrency):'시장 가격 확인 필요'}</dd></div></dl>{currency&&quoteCurrency&&currency!==quoteCurrency&&<p>원가와 시장 가격의 통화가 달라 손익을 비교하지 않습니다.</p>}<small>출처 · 내 보유 기록{price!=null?' / Supabase 시장 데이터':''}{row?.classification_as_of?` · 분류 기준일 ${row.classification_as_of}`:''} · 시계열 평가 기준일 미제공</small></li>
  })}</ul>}
 </details>
}
