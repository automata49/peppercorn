import type {InkStroke} from '../lib/lifetimeJournal'
import {inkColor,inkPath} from '../lib/notebookInk'
export function InkPreview({strokes}:{strokes:InkStroke[]}){
 const height=strokes.some(s=>s[0]?.tool)?strokes.reduce((max,s)=>s.reduce((n,p)=>Math.max(n,p.y+20),max),400):400
 return <svg className="ink-preview" viewBox={`0 0 1000 ${height}`} role="img" aria-label="나의 손글씨">{strokes.map((s,i)=>s[0]?.tool?<path key={i} d={inkPath(s)} fill={inkColor(s[0]?.color)} opacity={s[0]?.tool==='highlighter'?.3:s[0]?.tool==='pencil'?.65:1}/>:<polyline key={i} points={s.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>)}</svg>
}
