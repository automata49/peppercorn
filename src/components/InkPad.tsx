import type {InkStroke} from '../lib/lifetimeJournal'
import {inkColor,inkPath} from '../lib/notebookInk'

/** Crop only the reading preview; never modify stored paper-space points. */
export function inkPreviewBox(strokes:InkStroke[],fit=false){
 let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity
 for(const stroke of strokes)for(const p of stroke){
  if(!Number.isFinite(p.x)||!Number.isFinite(p.y))continue
  left=Math.min(left,p.x);right=Math.max(right,p.x)
  top=Math.min(top,p.y);bottom=Math.max(bottom,p.y)
 }
 const originalHeight=strokes.some(s=>s[0]?.tool)&&Number.isFinite(bottom)?Math.max(400,bottom+20):400
 if(!fit||!Number.isFinite(left))return `0 0 1000 ${originalHeight}`
 const margin=24
 return `${left-margin} ${top-margin} ${Math.max(320,right-left+margin*2)} ${Math.max(64,bottom-top+margin*2)}`
}
export function InkPreview({strokes,fit=false}:{strokes:InkStroke[];fit?:boolean}){
 return <svg className="ink-preview" viewBox={inkPreviewBox(strokes,fit)} role="img" aria-label="나의 손글씨" preserveAspectRatio="xMinYMin meet">{strokes.map((s,i)=>s[0]?.tool?<path key={i} d={inkPath(s)} fill={inkColor(s[0]?.color)} opacity={s[0]?.tool==='highlighter'?.3:s[0]?.tool==='pencil'?.65:1}/>:<polyline key={i} points={s.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>)}</svg>
}
