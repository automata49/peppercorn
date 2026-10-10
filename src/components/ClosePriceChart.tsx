import { useEffect, useRef, useState } from 'react'
import { createChart, LineSeries, ColorType, type IChartApi, type Time } from 'lightweight-charts'
import type { History } from '../lib/priceHistory'
export default function ClosePriceChart({history,name,currency}:{history:History;name:string;currency:string}){
 const root=useRef<HTMLDivElement>(null),[index,setIndex]=useState(history.dates.length-1)
 const chartRef=useRef<IChartApi|null>(null)
 useEffect(()=>{
  const host=root.current;if(!host)return
  const css=()=>getComputedStyle(host)
  const chart=createChart(host,{height:280,layout:{background:{type:ColorType.Solid,color:'transparent'},textColor:css().getPropertyValue('--folio-ink').trim()||'#111113',fontFamily:'Inter, system-ui, sans-serif',attributionLogo:true},grid:{vertLines:{visible:false},horzLines:{visible:false}},rightPriceScale:{borderVisible:false},timeScale:{borderVisible:false},handleScroll:{vertTouchDrag:false},handleScale:{axisPressedMouseMove:true,mouseWheel:false,pinch:true}})
  chartRef.current=chart
  const series=chart.addSeries(LineSeries,{color:css().getPropertyValue('--folio-ink').trim()||'#111113',lineWidth:2,priceFormat:{type:'price',precision:currency==='KRW'?0:2,minMove:currency==='KRW'?1:.01}})
  series.setData(history.dates.map((time,i)=>({time:time as Time,value:history.closes[i]})))
  chart.timeScale().fitContent()
  chart.subscribeCrosshairMove(p=>{if(p.time){const i=history.dates.indexOf(String(p.time));if(i>=0)setIndex(i)}})
  const observer=new ResizeObserver(()=>chart.applyOptions({width:host.clientWidth}));observer.observe(host)
  const theme=new MutationObserver(()=>{chart.applyOptions({layout:{textColor:css().getPropertyValue('--folio-ink').trim()||'#111113'}});series.applyOptions({color:css().getPropertyValue('--folio-ink').trim()||'#111113'})});theme.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme','data-theme-mode']})
  const media=matchMedia('(prefers-color-scheme: dark)');const recolor=()=>{chart.applyOptions({layout:{textColor:css().getPropertyValue('--folio-ink').trim()||'#111113'}});series.applyOptions({color:css().getPropertyValue('--folio-ink').trim()||'#111113'})};media.addEventListener('change',recolor)
  return()=>{observer.disconnect();theme.disconnect();media.removeEventListener('change',recolor);chart.remove();chartRef.current=null}
 },[history,currency])
 const selected=Math.min(index,history.dates.length-1)
 return <section className="close-price-chart" aria-label="일별 종가 확대 차트"><div className="chart-readout"><time>{history.dates[selected]}</time><span>{name} <b>{history.closes[selected]?.toLocaleString('ko-KR',{maximumFractionDigits:currency==='KRW'?0:2})} {currency}</b></span></div><div ref={root} role="img" aria-label={`${name} 실제 일별 종가 차트`}/><input type="range" className="chart-scrubber" min={0} max={history.dates.length-1} value={selected} aria-label="종가 날짜 탐색" aria-valuetext={`${history.dates[selected]} ${history.closes[selected]} ${currency}`} onChange={e=>setIndex(Number(e.target.value))}/><p className="note">일별 종가 · 드래그와 핀치로 확대 · <button onClick={()=>chartRef.current?.timeScale().fitContent()}>전체 기간</button> · <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">TradingView Lightweight Charts™</a></p></section>
}
