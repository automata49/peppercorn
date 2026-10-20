import {useEffect,useRef} from 'react'

export type FilterWheelOption = {value:string;label:string;disabled?:boolean}
export function FilterWheel({label,value,options,onChange,className=''}:{label:string;value:string;options:FilterWheelOption[];onChange:(value:string)=>void;className?:string}){
  const viewport=useRef<HTMLDivElement>(null)
  const settle=useRef<ReturnType<typeof setTimeout>|null>(null)
  const autoScroll=useRef(false)
  const active=options.findIndex(option=>option.value===value)
  const index=active<0?0:active

  useEffect(()=>{
    const rail=viewport.current
    const button=rail?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
    if(!rail||!button)return
    autoScroll.current=true
    rail.scrollTo({left:Math.max(0,button.offsetLeft-(rail.clientWidth-button.clientWidth)/2),behavior:'smooth'})
    const timeout=setTimeout(()=>{autoScroll.current=false},350)
    return()=>clearTimeout(timeout)
  },[value,options.length])

  useEffect(()=>()=>{if(settle.current)clearTimeout(settle.current)},[])

  const step=(direction:number)=>{
    let next=index+direction
    while(next>=0&&next<options.length&&options[next].disabled)next+=direction
    if(next>=0&&next<options.length)onChange(options[next].value)
  }
  const settleScroll=()=>{
    if(autoScroll.current)return
    if(settle.current)clearTimeout(settle.current)
    settle.current=setTimeout(()=>{
      const rail=viewport.current
      if(!rail)return
      const center=rail.scrollLeft+rail.clientWidth/2
      const nearest=options.map((option,i)=>({option,i,button:rail.querySelector<HTMLButtonElement>(`[data-wheel-index="${i}"]`)}))
        .filter(item=>!item.option.disabled&&item.button)
        .sort((a,b)=>Math.abs((a.button!.offsetLeft+a.button!.clientWidth/2)-center)-Math.abs((b.button!.offsetLeft+b.button!.clientWidth/2)-center))[0]
      if(nearest&&nearest.option.value!==value)onChange(nearest.option.value)
    },160)
  }
  return <div className="catalog-wheel" data-wheel={label}>
    <div className="catalog-wheel-heading"><span>{label}</span><div className="catalog-wheel-arrows">
      <button type="button" aria-label={label+' 이전 선택'} disabled={!options.slice(0,index).some(o=>!o.disabled)} onClick={()=>step(-1)}>‹</button>
      <button type="button" aria-label={label+' 다음 선택'} disabled={!options.slice(index+1).some(o=>!o.disabled)} onClick={()=>step(1)}>›</button>
    </div></div>
    <div className={'catalog-wheel-track '+className} ref={viewport} onScroll={settleScroll} role="group" aria-label={label}>
      {options.map((option,i)=><button key={option.value} data-wheel-index={i} data-offset={Math.max(-3,Math.min(3,i-index))} type="button" aria-pressed={option.value===value} disabled={option.disabled} onClick={()=>onChange(option.value)}>{option.label}</button>)}
    </div>
  </div>
}
