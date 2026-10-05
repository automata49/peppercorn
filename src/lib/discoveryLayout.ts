import { useEffect, useState } from 'react'

// Static-host SDUI: presentation only. Unknown versions/components fall back as a unit.
export type DiscoveryLayout = { version:1; component:'leader-spotlight'; title:string; subtitle:string; previewCount:number }
export const DEFAULT_DISCOVERY:DiscoveryLayout={version:1,component:'leader-spotlight',title:'오늘의 리더',subtitle:'강한 업종에서, 깊이 볼 한 종목.',previewCount:4}
export function parseDiscovery(value:unknown):DiscoveryLayout|null{
  if(!value||typeof value!=='object')return null
  const v=value as Record<string,unknown>
  if(v.version!==1||v.component!=='leader-spotlight'||typeof v.title!=='string'||!v.title.trim()||v.title.length>40||typeof v.subtitle!=='string'||v.subtitle.length>80||typeof v.previewCount!=='number'||!Number.isInteger(v.previewCount)||v.previewCount<1||v.previewCount>12)return null
  return {version:1,component:'leader-spotlight',title:v.title,subtitle:v.subtitle,previewCount:v.previewCount}
}
export function useDiscoveryLayout(){
  const [layout,setLayout]=useState(DEFAULT_DISCOVERY)
  useEffect(()=>{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),3000)
    fetch(import.meta.env.BASE_URL+'discovery-layout.json',{cache:'no-store',signal:controller.signal})
      .then(r=>r.ok?r.json():null).then(value=>{const next=parseDiscovery(value);if(next&&!controller.signal.aborted)setLayout(next)}).catch(()=>{}).finally(()=>clearTimeout(timer))
    return()=>{clearTimeout(timer);controller.abort()}
  },[])
  return layout
}
