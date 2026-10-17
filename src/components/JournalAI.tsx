import {useState} from 'react'
import {ensureSession,type Session} from '../lib/session'
import {Button} from './ui/button'
export type JournalMessage={role:'user'|'assistant';content:string}
const endpoint='https://mhbcchegrbakearqptdr.supabase.co/functions/v1/journal-ai'
export function JournalAI({session,messages,onChange,context}:{session:Session|null;messages:JournalMessage[];onChange:(value:JournalMessage[])=>void;context:string}){
 const [draft,setDraft]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
 async function ask(){
  const question=draft.trim()
  if(!question||busy||!session)return
  setBusy(true);setError('')
  const outgoing:JournalMessage[]=[...messages,{role:'user',content:question}]
  onChange(outgoing);setDraft('')
  try{
   const fresh=await ensureSession(session)
   const response=await fetch(endpoint,{method:'POST',headers:{Authorization:'Bearer '+fresh.access_token,'Content-Type':'application/json'},body:JSON.stringify({messages:outgoing.slice(-12),context:context.slice(0,10000)})})
   const data=await response.json().catch(()=>({}))
   if(!response.ok)throw Error(data.error==='model_unconfigured'?'AI 연결을 위한 서버 Gemini 키 설정이 필요합니다.':data.error==='rate_limited'?'잠시 후 다시 요청하세요.':data.error||'AI 응답을 불러오지 못했습니다.')
   if(typeof data.reply!=='string'||!data.reply.trim())throw Error('AI 응답이 비어 있습니다.')
   onChange([...outgoing,{role:'assistant',content:data.reply}])
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 return <section className="journal-ai" aria-label="저널 AI 대화">
  <h3>AI와 생각 정리</h3><p>가설을 반박하거나 확인할 질문을 남겨보세요. AI는 저널을 자동 수정하지 않습니다.</p>
  <div className="journal-ai-messages" role="log" aria-label="AI 대화 기록">{messages.map((m,i)=><article key={i} data-role={m.role}><b>{m.role==='user'?'나':'AI'}</b><p>{m.content}</p></article>)}</div>
  {!session&&<p>AI 대화는 로그인 후 사용할 수 있습니다.</p>}
  <label className="sr-only" htmlFor="journal-ai-question">AI에게 질문</label>
  <textarea id="journal-ai-question" disabled={!session||busy} value={draft} onChange={e=>setDraft(e.target.value)} maxLength={2000} placeholder="예: 이 투자 가설의 가장 약한 근거는 무엇일까?"/>
  {error&&<p role="alert">{error}</p>}<Button disabled={!session||busy||!draft.trim()} onClick={()=>void ask()}>{busy?'답변 작성 중…':'AI에게 질문'}</Button>
  <small>질문을 보낼 때 작성 중인 본문과 투자 가설이 AI 서버에 전달됩니다. 대화는 페이지 저장 시 기록됩니다.</small>
 </section>
}
