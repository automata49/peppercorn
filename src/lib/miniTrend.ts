import type {History} from './priceHistory'
// Mini trend uses actual daily closes; gaps are separate subpaths, never interpolated.
export function miniTrend(h:History|undefined){
 if(!h||h.closes.length<2||h.dates.length!==h.closes.length)return null
 const closes=h.closes.slice(-21),dates=h.dates.slice(-21)
 const valid=closes.map((v,i)=>Number.isFinite(v)&&v>0&&/^\d{4}-\d{2}-\d{2}$/.test(dates[i]))
 const values=closes.filter((_,i)=>valid[i]);if(values.length<2)return null
 const low=Math.min(...values),high=Math.max(...values),span=high-low
 let path='',drawing=false,segments=0
 closes.forEach((v,i)=>{if(!valid[i]){drawing=false;return}const x=3+i/(closes.length-1)*94,y=span?41-(v-low)/span*34:24;path+=(drawing?' L':' M')+x.toFixed(2)+','+y.toFixed(2);if(drawing)segments++;drawing=true})
 if(!segments)return null
 return {path,complete:h.closes.length>=21&&valid.every(Boolean),start:dates[0],end:dates.at(-1),up:values.at(-1)!>=values[0]}
}
