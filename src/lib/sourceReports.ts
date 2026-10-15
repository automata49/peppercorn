import { useCallback, useEffect, useState } from 'react'
import { ensureSession, loadStoredSession, type Session } from './session'

export type SourceReport = { drive_file_id:string; title:string; source_url:string; source_modified_at:string; imported_at:string; summary:string[]; content_hash:string }
export type ReportPage = { number:number; text:string; images:string[] }
export type ReportDetail = SourceReport & {pages:ReportPage[];links:{label:string;url:string}[]}
const endpoint='https://mhbcchegrbakearqptdr.supabase.co/functions/v1/source-reports'
const safeLink=(s:unknown)=>{try{const u=new URL(String(s));return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password}catch{return false}}
export function parseReports(raw:unknown):SourceReport[]{
 if(!Array.isArray(raw)||raw.length>100)throw Error('리포트 목록을 확인할 수 없습니다.')
 return raw.filter((r):r is SourceReport=>!!r&&/^[A-Za-z0-9_-]{10,100}$/.test(r.drive_file_id)&&typeof r.title==='string'&&r.title.length<=250&&r.source_url===`https://drive.google.com/file/d/${r.drive_file_id}/view`&&Number.isFinite(Date.parse(r.source_modified_at))&&Number.isFinite(Date.parse(r.imported_at))&&/^[a-f0-9]{64}$/.test(r.content_hash)&&Array.isArray(r.summary)&&r.summary.length<=5&&r.summary.every((x:unknown)=>typeof x==='string'&&x.length<=600))
}
export function parseReportDetail(raw:unknown):ReportDetail{
 const base=parseReports([raw])[0],r=raw as ReportDetail
 if(!base||!Array.isArray(r.pages)||!r.pages.length||r.pages.length>60||!Array.isArray(r.links)||r.links.length>500)throw Error('리포트 전문을 확인할 수 없습니다.')
 let images=0,chars=0
 for(const p of r.pages){
  if(!Number.isInteger(p.number)||typeof p.text!=='string'||!Array.isArray(p.images))throw Error('리포트 페이지를 확인할 수 없습니다.')
  chars+=p.text.length
  for(const img of p.images){images++;if(typeof img!=='string'||!/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(img)||img.length>2000000)throw Error('리포트 이미지를 확인할 수 없습니다.')}
 }
 if(images>60||chars>500000||r.links.some(l=>typeof l.label!=='string'||l.label.length>500||!safeLink(l.url)))throw Error('리포트 크기 또는 출처를 확인할 수 없습니다.')
 return r
}
export function useSourceReports(session:Session|null){
 const uid=session?.user.id||'',token=session?.access_token
 const [state,setState]=useState<{uid:string;items:SourceReport[];error:string}>({uid:'',items:[],error:''})
 const [revision,setRevision]=useState(0)
 useEffect(()=>{
  if(!session){setState({uid:'',items:[],error:''});return}
  let active=true;const controller=new AbortController()
  const run=async()=>{
   try{const current=await ensureSession(session);if(!active||loadStoredSession()?.user.id!==uid)return
    const response=await fetch(endpoint,{headers:{Authorization:'Bearer '+current.access_token},signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)]),cache:'no-store'})
    if(!response.ok)throw Error('리포트를 불러오지 못했습니다.')
    const body=await response.json(),items=parseReports(body.rows)
    if(active&&loadStoredSession()?.user.id===uid)setState({uid,items,error:''})
   }catch{if(active&&!controller.signal.aborted)setState(old=>({uid,items:old.uid===uid?old.items:[],error:'리포트를 불러오지 못했습니다. 다시 시도해주세요.'}))}
  }
  void run();const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void run()},300000)
  return()=>{active=false;controller.abort();window.clearInterval(timer)}
 },[uid,token,revision])
 const detail=useCallback(async(id:string,signal:AbortSignal)=>{
  if(!session||loadStoredSession()?.user.id!==uid)throw Error('로그인이 필요합니다.')
  const current=await ensureSession(session)
  if(signal.aborted||loadStoredSession()?.user.id!==uid)throw Error('계정이 변경되었습니다.')
  const response=await fetch(endpoint+'?id='+encodeURIComponent(id),{headers:{Authorization:'Bearer '+current.access_token},signal:AbortSignal.any([signal,AbortSignal.timeout(20000)]),cache:'no-store'})
  if(!response.ok)throw Error('리포트 전문을 불러오지 못했습니다.')
  const body=await response.json()
  if(signal.aborted||loadStoredSession()?.user.id!==uid)throw Error('계정이 변경되었습니다.')
  return parseReportDetail(body.rows?.[0])
 },[uid,token])
 return {uid,items:state.uid===uid?state.items:[],error:state.uid===uid?state.error:'',refresh:()=>setRevision(n=>n+1),detail}
}
export type ReportController=ReturnType<typeof useSourceReports>
