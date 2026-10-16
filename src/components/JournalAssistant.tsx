import {useState,type FormEvent} from 'react'
import type {Session} from '../lib/session'
import type {JournalChatTurn} from '../lib/lifetimeJournal'
import {journalAiReply} from '../lib/journalAssistant'
export function JournalAssistant({session,messages,context,onMessages}:{session:Session|null;messages:JournalChatTurn[];context:string;onMessages:(next:JournalChatTurn[])=>void}){
 const [input,setInput]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
 async function send(e:FormEvent){
  e.preventDefault();const question=input.trim();if(!question||busy)return
  setInput('');setError('');setBusy(true)
  const next=[...messages,{role:'user' as const,content:question,at:new Date().toISOString()}].slice(-40)
  onMessages(next)
  try{const reply=await journalAiReply(session,next,context);onMessages([...next,{role:'assistant',content:reply,at:new Date().toISOString()}].slice(-40))}
  catch(err){setError((err as Error).message)}
  finally{setBusy(false)}
 }
 return <details className="journal-ai-panel"><summary>AI와 대화 · 이 저널의 생각 검토하기</summary><div className="journal-ai-conversation">
 <p className="journal-ai-disclosure">질문을 보내면 현재 저널의 텍스트와 대화 내역이 AI 서비스로 전달됩니다. AI는 기록을 임의로 바꾸지 않습니다.</p>
 <div role="log" aria-label="저널 AI 대화" aria-live="polite">{messages.map((m,i)=><article key={m.at+i} className={'journal-chat-'+m.role}><small>{m.role==='user'?'나':'AI'}</small><p>{m.content}</p></article>)}</div>
 <form onSubmit={e=>void send(e)}><label htmlFor="journal-ai-question">AI에게 질문하기</label><textarea id="journal-ai-question" maxLength={1800} rows={2} value={input} onChange={e=>setInput(e.target.value)} placeholder="이 Thesis의 반대 증거는?"/><button disabled={busy||!input.trim()||!session} type="submit">{busy?'응답 중…':'질문 보내기'}</button></form>
 {!session&&<p>로그인하면 AI 대화를 사용할 수 있습니다.</p>}{error&&<p role="alert">{error}</p>}
 </div></details>
}
