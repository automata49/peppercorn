import {getStroke} from 'perfect-freehand'
import type {InkPoint,InkStroke} from './lifetimeJournal'
export const inkColors=['ink','blue','red','green','yellow'] as const
export type InkColor=typeof inkColors[number]
export type PaperStyle='plain'|'ruled'|'grid'
export const inkColor=(color?:string)=>({blue:'#3266bb',red:'#c34350',green:'#287766',yellow:'#d1a21d'}[color||'']||'currentColor')
export function inkPath(stroke:InkStroke){
 if(!stroke.length)return ''
 const first=stroke[0],marker=first.tool==='highlighter'
 const outline=getStroke(stroke,{size:first.size||3,thinning:marker?0:.45,smoothing:.6,streamline:.45,simulatePressure:first.pressure===undefined,last:true})
 return outline.length?'M'+outline.map(p=>p.join(',')).join('L')+'Z':''
}
export function inkBounds(strokes:InkStroke[],indices:number[]){
 let x=Infinity,y=Infinity,right=-Infinity,bottom=-Infinity
 for(const i of indices)for(const p of strokes[i]||[]){x=Math.min(x,p.x);y=Math.min(y,p.y);right=Math.max(right,p.x);bottom=Math.max(bottom,p.y)}
 return x===Infinity?null:{x,y,right,bottom}
}
export function nearStroke(stroke:InkStroke,p:InkPoint,radius:number){
 return stroke.some((b,i)=>{
  const a=stroke[Math.max(0,i-1)],dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy
  const t=length?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/length)):0
  return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)<=radius+(stroke[0]?.size||3)/2
 })
}
