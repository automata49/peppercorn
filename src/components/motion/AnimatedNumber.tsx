import { useLayoutEffect, useRef } from 'react'
import { motionTokens, prefersReducedMotion } from '../../motion/system'
/** Ticker-inspired web implementation. Animate only old → exact new digits, never a fabricated quote. */
export function AnimatedNumber({value}:{value:string}){
 const root=useRef<HTMLSpanElement>(null),previous=useRef(value)
 const before=previous.current
 const changed=before!==value
 const ascending=Number(value.replace(/[^0-9.-]/g,''))>=Number(before.replace(/[^0-9.-]/g,''))
 useLayoutEffect(()=>{
  previous.current=value
  if(!changed||prefersReducedMotion())return
  const sign=ascending?1:-1
  const animations:Animation[]=[]
  root.current?.querySelectorAll<HTMLElement>('[data-changed=true]').forEach(slot=>{
   const next=slot.querySelector<HTMLElement>('.ticker-current'),old=slot.querySelector<HTMLElement>('.ticker-previous')
   if(next)animations.push(next.animate([{transform:`translateY(${sign*100}%)`,opacity:0},{transform:'translateY(0)',opacity:1}],{duration:motionTokens.number,easing:motionTokens.ease}))
   if(old)animations.push(old.animate([{transform:'translateY(0)',opacity:1},{transform:`translateY(${-sign*100}%)`,opacity:0}],{duration:motionTokens.number,easing:motionTokens.ease}))
  })
  return()=>animations.forEach(a=>a.cancel())
 },[value])
 return <span ref={root} className="animated-number" role="img" aria-label={value}>{Array.from(value,(digit,i)=>{
  const old=before[before.length-value.length+i]
  const animate=changed&&old!==digit&&/[0-9]/.test(digit)
  return <span key={value.length-i} aria-hidden="true" className={/[0-9]/.test(digit)?'ticker-digit':'ticker-static'} data-changed={animate}>{animate&&old&&<span className="ticker-previous" data-digit={old} style={{opacity:0}}/>}<span className="ticker-current">{digit}</span></span>
 })}</span>
}
