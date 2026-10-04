import { useState, type ReactNode } from 'react'

export function ProgressiveDisclosure({
  title,
  meta,
  className='',
  children,
  mobileCollapsed=true
}:{
  title:string
  meta?:string
  className?:string
  children:ReactNode
  mobileCollapsed?:boolean
}){
  const [open,setOpen]=useState(()=>{
    if(!mobileCollapsed)return true
    try{return !window.matchMedia('(max-width: 650px)').matches}catch{return true}
  })
  return <details className={('progressive-disclosure '+className).trim()} open={open} onToggle={e=>setOpen(e.currentTarget.open)}>
    <summary><span>{title}</span>{meta&&<small>{meta}</small>}</summary>
    <div className="progressive-disclosure-body">{children}</div>
  </details>
}
