import { useCallback, useLayoutEffect, useRef, useState } from 'react'
/** Observe the actual mounted element, including charts mounted after asynchronous data. */
export function useElementWidth<T extends HTMLElement>(){
  const [element,setElement]=useState<T|null>(null)
  const [width,setWidth]=useState(0)
  const current=useRef<T|null>(null)
  const ref=useCallback((node:T|null)=>{
    current.current=node
    setElement(node)
  },[])
  useLayoutEffect(()=>{
    if(!element){setWidth(0);return}
    setWidth(element.clientWidth)
    const observer=new ResizeObserver(entries=>{
      if(current.current===element)setWidth(entries[0].contentRect.width)
    })
    observer.observe(element)
    return()=>observer.disconnect()
  },[element])
  return [ref,width] as const
}
