import {useEffect,useRef,useState} from 'react'
import {parseInstinctNews,type InstinctArticle} from './instinctLeaderNews'
export const newsIdentity=(url:string)=>{const parsed=new URL(url);parsed.hash='';return parsed.href}
const key=(scope:string)=>'folio-news-scraps:v1:'+scope
function read(scope:string):InstinctArticle[]{
 const raw=localStorage.getItem(key(scope));if(!raw)return []
 const feed=parseInstinctNews(JSON.parse(raw));if(!feed)throw Error('스크랩 목록을 읽지 못했습니다.')
 return feed.items
}
/** Public articles only, account-scoped on this device. Never store private report text. */
export function useNewsScraps(scope:string){
 const current=useRef(scope);current.current=scope
 const [state,setState]=useState<{scope:string;items:InstinctArticle[];error:string}>({scope,items:[],error:''})
 const refresh=()=>{try{setState({scope,items:read(scope),error:''})}catch{setState({scope,items:[],error:'스크랩 목록을 읽지 못했습니다. 기기 저장 공간을 확인해주세요.'})}}
 useEffect(()=>{
  refresh()
  const changed=(e:StorageEvent)=>{if(e.key===key(scope)||e.key===null)refresh()}
  window.addEventListener('storage',changed);return()=>window.removeEventListener('storage',changed)
 },[scope])
 const toggle=async(item:InstinctArticle)=>{
  const run=()=>{
   if(current.current!==scope)return
   try{
    const items=read(scope),id=newsIdentity(item.source_url),exists=items.some(a=>newsIdentity(a.source_url)===id)
    const next=exists?items.filter(a=>newsIdentity(a.source_url)!==id):[item,...items]
    const feed=parseInstinctNews({version:1,updated_at:new Date().toISOString(),items:next})
    if(!feed||feed.items.length!==next.length)throw Error('Invalid article')
    localStorage.setItem(key(scope),JSON.stringify(feed))
    setState({scope,items:feed.items,error:''})
   }catch{if(current.current===scope)setState(s=>({...s,error:'스크랩을 저장하지 못했습니다. 기기 저장 공간을 확인해주세요.'}))}
  }
  if(navigator.locks)await navigator.locks.request(key(scope),run);else run()
 }
 return {items:state.scope===scope?state.items:[],error:state.scope===scope?state.error:'',toggle}
}
