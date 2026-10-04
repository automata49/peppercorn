import { useEffect, useMemo, useRef, useState } from 'react'
import { buildBookmarklet, draftFromMessage, loadExternalResearch, saveExternalResearch, type ExternalResearchItem, type ResearchDraft } from '../lib/researchIngest'
import type { Session } from '../lib/session'

const emptyDraft=():ResearchDraft=>({source_kind:'manual_capture',source_name:'',source_url:'',title:'',content:''})
const statusLabel=(status:ExternalResearchItem['analysis_status'])=>status==='analyzed'?'분석 완료':status==='pending'?'분석 대기':status==='error'?'분석 오류':status==='archived'?'보관됨':'AI 미연결'
const when=(value:string)=>{const d=new Date(value);return Number.isNaN(d.getTime())?value:d.toLocaleString('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}

export function ResearchInbox({session,onSession,onLogin}:{session:Session|null;onSession:(session:Session)=>void;onLogin:()=>void}){
  const [items,setItems]=useState<ExternalResearchItem[]>([])
  const [draft,setDraft]=useState<ResearchDraft>(emptyDraft)
  const [loading,setLoading]=useState(false)
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const formRef=useRef<HTMLDivElement|null>(null)
  const captureMode=useMemo(()=>new URLSearchParams(location.search).get('capture')==='1',[])
  const bookmarklet=useMemo(()=>buildBookmarklet(),[])

  const reload=async(active=session)=>{
    if(!active){setItems([]);return}
    setLoading(true);setError('')
    try{const result=await loadExternalResearch(active);onSession(result.session);setItems(result.rows)}
    catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setLoading(false)}
  }
  useEffect(()=>{void reload()},[session?.access_token])

  useEffect(()=>{
    const handler=(event:MessageEvent)=>{
      const next=draftFromMessage(event)
      if(!next)return
      setDraft(next);setNotice('브라우저에서 원문을 받았습니다. 내용 확인 후 저장하세요.')
      window.setTimeout(()=>formRef.current?.scrollIntoView({behavior:'smooth',block:'center'}),20)
    }
    window.addEventListener('message',handler)
    return()=>window.removeEventListener('message',handler)
  },[])

  const save=async()=>{
    if(!session){onLogin();return}
    if(!draft.source_url.trim()||!draft.title.trim()||!draft.content.trim()){setError('URL, 제목, 본문을 입력하세요.');return}
    setSaving(true);setError('');setNotice('')
    try{
      const result=await saveExternalResearch(session,{...draft,source_name:draft.source_name.trim()||new URL(draft.source_url).hostname})
      onSession(result.session);setDraft(emptyDraft());setNotice('Research Inbox에 저장했습니다.');await reload(result.session)
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setSaving(false)}
  }
  const copyBookmarklet=async()=>{
    try{await navigator.clipboard.writeText(bookmarklet);setNotice('Save to Pepper 북마클릿 코드를 복사했습니다.')}
    catch{setNotice('클립보드 복사가 막혔습니다. ‘코드 보기’를 열어 북마클릿 코드를 직접 복사하세요.')}
  }

  return <section className="panel research-inbox">
    <div className="research-inbox-head">
      <div><small>External Research</small><h2>Research Inbox</h2><p>구독 중인 페이지를 서버가 크롤링하지 않습니다. 내가 열람한 화면에서 선택한 텍스트 또는 현재 본문을 직접 가져와 개인 RLS 영역에 저장합니다.</p></div>
      <div className="research-bookmarklet">
        <button type="button" className="primary" onClick={()=>void copyBookmarklet()}>Save to Pepper 설치</button>
        <details><summary>코드 보기</summary><code>{bookmarklet}</code></details>
      </div>
    </div>
    <div className="research-how"><b>사용</b><span>처음 한 번 ‘Save to Pepper 설치’로 코드를 복사해 브라우저 북마크 URL에 등록합니다. 이후 네이버 프리미엄 글을 연다 → 필요한 부분을 선택한다(선택이 없으면 article/main 본문 사용) → <b>Save to Pepper</b> 북마클릿 실행 → 아래에서 확인 후 저장.</span></div>
    {captureMode&&<p className="research-capture-mode">Capture 창입니다. 원문 페이지의 북마클릿 메시지를 기다립니다.</p>}
    <div ref={formRef} className="research-capture-form">
      <label>원문 URL<input value={draft.source_url} onChange={e=>setDraft(v=>({...v,source_url:e.target.value,source_kind:'manual_capture'}))} placeholder="https://contents.premium.naver.com/…"/></label>
      <label>제목<input value={draft.title} onChange={e=>setDraft(v=>({...v,title:e.target.value}))} placeholder="리서치 제목"/></label>
      <label className="research-content">본문<textarea value={draft.content} onChange={e=>setDraft(v=>({...v,content:e.target.value,source_kind:'manual_capture'}))} placeholder="직접 붙여넣기도 가능합니다." rows={7}/><small>{draft.content.length.toLocaleString('ko-KR')} / 120,000자</small></label>
      <div className="research-capture-actions">{!session&&<span>저장은 로그인이 필요합니다.</span>}<button type="button" className="primary" onClick={()=>void save()} disabled={saving}>{saving?'저장 중…':'Inbox에 저장'}</button>{!session&&<button type="button" onClick={onLogin}>로그인</button>}</div>
    </div>
    {(notice||error)&&<p className={error?'research-message error':'research-message'} role="status">{error||notice}</p>}
    <div className="research-inbox-list-head"><h3>저장된 자료</h3><span>{session?(loading?'불러오는 중…':items.length+'개'):'로그인 후 표시'}</span></div>
    {session&&!loading&&items.length===0&&<p className="empty">아직 저장된 외부 리서치가 없습니다.</p>}
    <div className="research-inbox-list">{items.map(item=><details key={item.id} className="research-item">
      <summary><span><b>{item.title}</b><small>{item.source_name||new URL(item.source_url).hostname} · {when(item.captured_at)}</small></span><em className={'research-status '+item.analysis_status}>{statusLabel(item.analysis_status)}</em></summary>
      <div className="research-item-body"><a href={item.source_url} target="_blank" rel="noreferrer">원문 열기 ↗</a><p>{item.content.slice(0,900)}{item.content.length>900?'…':''}</p>{item.analysis_status==='provider_unavailable'&&<small>현재 Pepper AI Analyst의 실사용 provider가 연결되지 않아 원문만 안전하게 보관합니다.</small>}</div>
    </details>)}</div>
  </section>
}
