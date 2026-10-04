import {useEffect,useMemo,useRef,useState} from 'react'
import type {Session} from '../lib/session'
import {clearCaptureRequest,deleteResearchCapture,draftFromCaptureMessage,loadResearchInbox,saveResearchCapture,saveToPepperBookmarklet,type CaptureDraft,type ResearchCapture,type ResearchFeedItem} from '../lib/research'

const emptyDraft:CaptureDraft={source_url:'',title:'',captured_text:''}
const date=(value:string|null)=>value?new Date(value).toLocaleString('ko-KR',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'—'
const preview=(text:string,n=180)=>text.length>n?text.slice(0,n).trim()+'…':text
const sourceLabel=(item:ResearchFeedItem)=>item.linked_type==='naver_premium'?'Naver Premium':item.linked_type==='youtube'?'YouTube':'Telegram'

export function ResearchInbox({session,onSession}:{session:Session|null;onSession:(session:Session)=>void}){
  const [feed,setFeed]=useState<ResearchFeedItem[]>([])
  const [captures,setCaptures]=useState<ResearchCapture[]>([])
  const [draft,setDraft]=useState<CaptureDraft>(emptyDraft)
  const [state,setState]=useState<'idle'|'loading'|'saving'|'error'>('idle')
  const [message,setMessage]=useState('')
  const pendingRef=useRef<CaptureDraft|null>(null)
  const loadedFor=useRef<string>('')

  useEffect(()=>{
    if(new URLSearchParams(location.search).get('capture')==='1')setMessage('Save to Pepper에서 본문을 받는 중입니다…')
    const receive=(event:MessageEvent)=>{
      const incoming=draftFromCaptureMessage(event.data,event.origin);if(!incoming)return
      clearCaptureRequest();pendingRef.current=incoming;setDraft(incoming);setMessage(session?'Save to Pepper 캡처를 저장합니다.':'캡처를 받았습니다. 로그인하면 저장합니다.')
      try{(event.source as WindowProxy|null)?.postMessage({type:'pepper-capture-ack'},event.origin)}catch{}
    }
    window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive)
  },[session?.user.id])

  useEffect(()=>{
    if(!session){setFeed([]);setCaptures([]);loadedFor.current='';return}
    let cancelled=false;setState('loading')
    loadResearchInbox(session).then(result=>{
      if(cancelled)return
      onSession(result.session);setFeed(result.feed);setCaptures(result.captures);loadedFor.current=result.session.user.id;setState('idle')
    }).catch(()=>{if(!cancelled){setState('error');setMessage('External Research를 불러오지 못했습니다.')}})
    return()=>{cancelled=true}
  },[session?.user.id])

  const save=async(value:CaptureDraft)=>{
    if(!session){setMessage('상단에서 로그인한 뒤 저장할 수 있습니다.');return false}
    if(!value.source_url.trim().startsWith('https://')||!value.captured_text.trim()){setMessage('원문 URL과 본문 텍스트가 필요합니다.');return false}
    setState('saving')
    try{
      const result=await saveResearchCapture(session,value);onSession(result.session)
      setCaptures(rows=>[result.capture,...rows.filter(r=>r.id!==result.capture.id&&r.content_hash!==result.capture.content_hash)])
      setDraft(emptyDraft);setMessage('저장 완료 · AI Analyst provider는 아직 연결되지 않아 원문만 보관합니다.');setState('idle');return true
    }catch{setState('error');setMessage('저장하지 못했습니다. 로그인 상태와 연결을 확인하세요.');return false}
  }

  useEffect(()=>{
    if(!session||!pendingRef.current||loadedFor.current!==session.user.id)return
    const value=pendingRef.current;pendingRef.current=null;void save(value)
  },[session?.user.id,state])

  const copyBookmarklet=async()=>{
    try{await navigator.clipboard.writeText(saveToPepperBookmarklet());setMessage('Save to Pepper 북마클릿을 복사했습니다. 브라우저 북마크 URL에 붙여넣으세요.')}
    catch{setMessage('클립보드 권한이 없어 복사하지 못했습니다.')}
  }
  const readClipboard=async()=>{
    try{const text=(await navigator.clipboard.readText()).trim();if(text)setDraft(v=>({...v,captured_text:text}));setMessage(text?'클립보드 본문을 불러왔습니다.':'클립보드가 비어 있습니다.')}
    catch{setMessage('클립보드 읽기 권한이 없습니다. 직접 붙여넣어 주세요.')}
  }
  const remove=async(id:string)=>{
    if(!session)return
    try{const result=await deleteResearchCapture(session,id);onSession(result.session);setCaptures(rows=>rows.filter(r=>r.id!==id));setMessage('캡처를 삭제했습니다.')}
    catch{setMessage('삭제하지 못했습니다.')}
  }
  const captureIds=useMemo(()=>new Set(captures.map(c=>c.feed_item_id).filter(Boolean)),[captures])

  return <section className="panel research-inbox" aria-labelledby="external-research-title">
    <div className="panel-head research-inbox-head"><div><h2 id="external-research-title">External Research</h2><p>공개 채널은 자동 감지합니다. 구독 본문은 서버가 크롤링하지 않고, 내가 연 페이지에서 Save to Pepper로 직접 저장합니다.</p></div>
      <button type="button" onClick={copyBookmarklet}>Save to Pepper 복사</button></div>
    {!session&&<div className="research-gate">로그인하면 자동 감지 Inbox와 개인 캡처가 클라우드에 연결됩니다.</div>}
    {message&&<div className={'research-message '+(state==='error'?'error':'')} role="status">{message}</div>}

    <div className="research-grid">
      <section className="research-box"><div className="research-box-title"><b>자동 감지</b><span>HS Academy · public Telegram</span></div>
        {session&&state==='loading'&&!feed.length?<p className="research-empty">불러오는 중…</p>:feed.length?feed.map(item=><article className="research-feed-item" key={item.id}>
          <div className="research-meta"><span>{sourceLabel(item)}</span><time>{date(item.published_at||item.discovered_at)}</time></div>
          <strong>{item.title}</strong>{item.excerpt&&<p>{preview(item.excerpt)}</p>}
          <div className="research-actions"><a href={item.linked_url||item.source_url} target="_blank" rel="noreferrer">원문 열기 ↗</a>
            <button type="button" disabled={captureIds.has(item.id)} onClick={()=>setDraft({feed_item_id:item.id,source_url:item.linked_url||item.source_url,title:item.title,captured_text:''})}>{captureIds.has(item.id)?'저장됨':'본문 붙여넣기 준비'}</button></div>
        </article>):<p className="research-empty">{session?'아직 감지된 항목이 없습니다.':'로그인 후 표시됩니다.'}</p>}
      </section>

      <section className="research-box"><div className="research-box-title"><b>Save to Pepper</b><span>사용자가 열람한 본문만</span></div>
        <label className="research-field"><span>원문 URL</span><input aria-label="External Research 원문 URL" value={draft.source_url} onChange={e=>setDraft(v=>({...v,source_url:e.target.value}))} placeholder="https://contents.premium.naver.com/…"/></label>
        <label className="research-field"><span>제목</span><input aria-label="External Research 제목" value={draft.title} onChange={e=>setDraft(v=>({...v,title:e.target.value}))}/></label>
        <label className="research-field"><span>본문 텍스트</span><textarea aria-label="External Research 본문 텍스트" value={draft.captured_text} onChange={e=>setDraft(v=>({...v,captured_text:e.target.value}))} rows={8} placeholder="페이지에서 Save to Pepper를 실행하거나 직접 붙여넣으세요."/></label>
        <div className="research-form-actions"><button type="button" className="text-button" onClick={readClipboard}>클립보드 불러오기</button><button type="button" className="primary-action" disabled={state==='saving'||!session} onClick={()=>void save(draft)}>{state==='saving'?'저장 중…':'Research 저장'}</button></div>
      </section>
    </div>

    <section className="research-saved"><div className="research-box-title"><b>내 캡처</b><span>{captures.length}건 · owner-only RLS</span></div>
      {captures.length?captures.map(item=><article className="research-capture-item" key={item.id}><div className="research-meta"><span>{item.source_type}</span><time>{date(item.captured_at)}</time></div>
        <div className="research-capture-main"><div><strong>{item.title||item.source_url}</strong><p>{preview(item.captured_text,240)}</p></div><span className={'pill '+(item.analysis_status==='ready'?'green':'gray')}>{item.analysis_status==='ready'?'AI 분석 완료':'AI 미연결'}</span></div>
        <div className="research-actions"><a href={item.source_url} target="_blank" rel="noreferrer">출처 ↗</a><button type="button" onClick={()=>void remove(item.id)}>삭제</button></div>
      </article>):<p className="research-empty">저장한 리서치가 없습니다.</p>}
    </section>
  </section>
}
