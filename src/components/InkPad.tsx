import type {InkStroke} from '../lib/lifetimeJournal'
import {inkColor,inkPath} from '../lib/notebookInk'

/** Crop only the reading preview; never modify stored paper-space points. */
export function inkPreviewBox(strokes:InkStroke[],fit=false){
 const points=strokes.flat().filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))
 const originalHeight=strokes.some(s=>s[0]?.tool)?Math.max(400,...points.map(p=>p.y+20)):400
 if(!fit||!points.length)return `0 0 1000 ${originalHeight}`
 const left=Math.min(...points.map(p=>p.x)),right=Math.max(...points.map(p=>p.x))
 const top=Math.min(...points.map(p=>p.y)),bottom=Math.max(...points.map(p=>p.y))
 const margin=24
 return `${left-margin} ${top-margin} ${Math.max(320,right-left+margin*2)} ${Math.max(64,bottom-top+margin*2)}`
}
export function InkPreview({strokes,fit=false}:{strokes:InkStroke[];fit?:boolean}){
 return <svg className="ink-preview" viewBox={inkPreviewBox(strokes,fit)} role="img" aria-label="나의 손글씨" preserveAspectRatio="xMinYMin meet">{strokes.map((s,i)=>s[0]?.tool?<path key={i} d={inkPath(s)} fill={inkColor(s[0]?.color)} opacity={s[0]?.tool==='highlighter'?.3:s[0]?.tool==='pencil'?.65:1}/>:<polyline key={i} points={s.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>)}</svg>
}
