import { useRef, useState } from 'react'
import type { InkStroke } from '../lib/lifetimeJournal'
import { Button } from './ui/button'
export function InkPreview({strokes}:{strokes:InkStroke[]}){
 return <svg className="ink-preview" viewBox="0 0 1000 400" role="img" aria-label="나의 손글씨"><g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">{strokes.map((s,i)=><polyline key={i} points={s.map(p=>`${p.x},${p.y}`).join(' ')}/>)}</g></svg>
}
export function InkPad({strokes,onChange}:{strokes:InkStroke[];onChange:(s:InkStroke[])=>void}){
 const [drawing,setDrawing]=useState<InkStroke>([]),[enabled,setEnabled]=useState(false)
 const active=useRef<{id:number;points:InkStroke}|null>(null)
 function finish(){if(active.current){onChange([...strokes,active.current.points]);active.current=null;setDrawing([])}}
 return <section className="ink-pad"><div className="journal-tools"><span>손글씨</span><Button variant={enabled?'secondary':'ghost'} aria-pressed={enabled} onClick={()=>{finish();setEnabled(!enabled)}}>{enabled?'필기 종료':'필기 시작'}</Button><Button variant="ghost" disabled={!strokes.length} onClick={()=>onChange(strokes.slice(0,-1))}>마지막 획 지우기</Button></div>
 <svg viewBox="0 0 1000 400" className={'ink-canvas'+(enabled?' is-drawing':'')} role="img" aria-label="손글씨 입력 영역" style={{touchAction:enabled?'none':'pan-y'}}
 onPointerDown={e=>{if(!enabled||active.current||e.pointerType==='touch')return;const r=e.currentTarget.getBoundingClientRect();const p={x:(e.clientX-r.left)/r.width*1000,y:(e.clientY-r.top)/r.height*400};e.currentTarget.setPointerCapture(e.pointerId);active.current={id:e.pointerId,points:[p,{...p,x:p.x+.1}]};setDrawing(active.current.points)}}
 onPointerMove={e=>{if(!active.current||active.current.id!==e.pointerId)return;const r=e.currentTarget.getBoundingClientRect();const p={x:Math.max(0,Math.min(1000,(e.clientX-r.left)/r.width*1000)),y:Math.max(0,Math.min(400,(e.clientY-r.top)/r.height*400))};active.current.points=[...active.current.points,p];setDrawing(active.current.points)}}
 onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}>
 <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">{[...strokes,drawing].map((s,i)=><polyline key={i} points={s.map(p=>`${p.x},${p.y}`).join(' ')}/>)}</g>
 {!strokes.length&&!drawing.length&&<text x="500" y="200" textAnchor="middle" fill="currentColor" opacity=".5" fontSize="28">펜으로 생각의 흔적을 남겨보세요</text>}</svg>
 <small>필기 시작 후 펜 또는 마우스로 입력하세요. 손가락 입력은 필기에 사용하지 않습니다.</small></section>
}
