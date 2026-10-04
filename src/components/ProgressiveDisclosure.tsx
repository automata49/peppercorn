import { useState, type ReactNode } from 'react'

export function ProgressiveDisclosure({
  title,
  meta,
  className='',
  children,
  mobileCollapsed=true,
  open:controlledOpen,
  onOpenChange
}:{
  title:string
  meta?:string
  className?:string
  children:ReactNode
  mobileCollapsed?:boolean
  open?:boolean
  onOpenChange?:(open:boolean)=>void
}){
  const [localOpen,setLocalOpen]=useState(()=>{
    if(!mobileCollapsed)return true
    try{return !window.matchMedia('(max-width: 650px)').matches}catch{return true}
  })
  const open=controlledOpen??localOpen
  const setOpen=(next:boolean)=>{
    if(controlledOpen===undefined)setLocalOpen(next)
    onOpenChange?.(next)
  }
  return <details className={('progressive-disclosure '+className).trim()} open={open} onToggle={e=>setOpen(e.currentTarget.open)}>
    <summary><span>{title}</span>{meta&&<small>{meta}</small>}</summary>
    <div className="progressive-disclosure-body">{children}</div>
  </details>
}
