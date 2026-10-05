import { useLayoutEffect, useRef } from 'react'
import { motionTokens, prefersReducedMotion } from '../../motion/system'
/** The exact value stays in the DOM. Only changed digits move; no intermediate financial values. */
export function AnimatedNumber({value}:{value:string}){
  const ref=useRef<HTMLSpanElement>(null)
  const previous=useRef(value)
  useLayoutEffect(()=>{
    const before=previous.current;previous.current=value
    if(before===value||prefersReducedMotion())return
    const animations=Array.from(ref.current?.children??[]).flatMap((node,i)=>{
      if(value[i]===before[i]||!/[0-9]/.test(value[i]))return []
      return [(node as HTMLElement).animate([{transform:'translateY(.55em)',opacity:0},{transform:'translateY(0)',opacity:1}],{duration:motionTokens.number,easing:motionTokens.ease})]
    })
    return ()=>animations.forEach(a=>a.cancel())
  },[value])
  return <span ref={ref} className="animated-number">{Array.from(value,(digit,i)=><span key={i}>{digit}</span>)}</span>
}
