import {Children,useEffect,useRef,useState,type ReactNode} from 'react'

/** One native scroll surface for news and private reports in every orientation. */
export function NewsCoverFlow({children}:{children:ReactNode}){
 const rail=useRef<HTMLDivElement>(null),[active,setActive]=useState(0)
 const count=Children.toArray(children).filter(Boolean).length
 useEffect(()=>{
  const el=rail.current;if(!el)return
  let frame=0
  const update=()=>{
   cancelAnimationFrame(frame)
   frame=requestAnimationFrame(()=>{
    const center=el.getBoundingClientRect().left+el.clientWidth/2
    let nearest=0,distance=Infinity
    Array.from(el.children).forEach((child,i)=>{
     const r=child.getBoundingClientRect(),delta=(r.left+r.width/2-center)/(r.width+24)
     ;(child as HTMLElement).style.setProperty('--news-offset',String(Math.max(-1,Math.min(1,delta))))
     ;(child as HTMLElement).style.setProperty('--news-distance',String(Math.min(1,Math.abs(delta))*.035))
     if(Math.abs(delta)<distance){distance=Math.abs(delta);nearest=i}
    })
    setActive(nearest)
   })
  }
  el.addEventListener('scroll',update,{passive:true})
  const resize=new ResizeObserver(update);resize.observe(el);update()
  return()=>{el.removeEventListener('scroll',update);resize.disconnect();cancelAnimationFrame(frame)}
 },[children])
 const go=(index:number)=>{
  const el=rail.current,card=el?.children[index] as HTMLElement|undefined
  if(!el||!card)return
  el.scrollTo({left:el.scrollLeft+card.getBoundingClientRect().left+card.getBoundingClientRect().width/2-(el.getBoundingClientRect().left+el.clientWidth/2),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})
 }
 return <div className="news-coverflow">
  <div ref={rail} className="discovery-news-stories" role="list" aria-label="뉴스와 리포트 Cover flow" tabIndex={0} onKeyDown={event=>{
   if(event.target!==event.currentTarget)return
   const next=event.key==='ArrowRight'?active+1:event.key==='ArrowLeft'?active-1:event.key==='Home'?0:event.key==='End'?count-1:null
   if(next!==null){event.preventDefault();go(Math.max(0,Math.min(count-1,next)))}
  }}>{children}</div>
  {count>1&&<nav className="news-coverflow-controls" aria-label="기사 넘기기"><button type="button" aria-label="이전 기사" disabled={active===0} onClick={()=>go(active-1)}>이전</button><span aria-live="polite">{active+1} / {count}</span><button type="button" aria-label="다음 기사" disabled={active>=count-1} onClick={()=>go(active+1)}>다음</button></nav>}
 </div>
}
