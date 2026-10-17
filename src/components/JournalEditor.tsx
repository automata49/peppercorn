import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import {JournalAI} from './JournalAI'
import type {Session} from '../lib/session'
import { Button } from './ui/button'
import {NotebookEditor} from './NotebookEditor'
import { blankSnapshot, entryPhotos, questions, snapshot, type JournalEntry, type EntrySnapshot } from '../lib/lifetimeJournal'
export type FinancialReference={ticker:string;label:string;summary:string}
export default function JournalEditor({entry,initialQuestion,onSave,onDirty,financials=[],session=null,storageLabel='이 기기에 보관한 기록'}:{storageLabel?:string;entry?:JournalEntry;initialQuestion?:string;onSave:(e:JournalEntry)=>Promise<void>;onDirty:(v:boolean)=>void;financials?:FinancialReference[];session?:Session|null}){
 const [draft,setDraft]=useState<EntrySnapshot>(()=>entry?snapshot(entry):{...blankSnapshot(),...(initialQuestion?{question:initialQuestion}:{})})
 const [saving,setSaving]=useState(false),[error,setError]=useState(''),[photoBusy,setPhotoBusy]=useState(false)
 const [financialQuery,setFinancialQuery]=useState(draft.ticker),[financeOpen,setFinanceOpen]=useState(false),[snippet,setSnippet]=useState<{id:number;text:string}>()
 function change(p:Partial<EntrySnapshot>){setDraft(d=>({...d,...p}));onDirty(true)}
 async function save(){
  if(!draft.title.trim()){setError('기록의 제목을 입력하세요.');return}
  setSaving(true);setError('')
  const now=new Date().toISOString()
  try{await onSave({...draft,title:draft.title.trim(),id:entry?.id||crypto.randomUUID(),createdAt:entry?.createdAt||now,updatedAt:now,revisions:entry?[...entry.revisions,{at:entry.updatedAt,snapshot:snapshot(entry)}]:[]});onDirty(false)}catch(e){setError((e as Error)?.message||'저장하지 못했습니다. 기록을 닫지 말고 저장 공간을 확인한 뒤 다시 시도하세요.')}finally{setSaving(false)}
 }
 return <div className="journal-editor" aria-busy={saving} inert={saving}>
 <div className="journal-editor-main">
 <div className="notebook-heading"><label className="sr-only" htmlFor="journal-title">기록 제목</label><input id="journal-title" className="journal-title-input" placeholder="오늘의 한 페이지" maxLength={160} value={draft.title} onChange={e=>change({title:e.target.value})}/><Button disabled={saving||photoBusy} onClick={()=>void save()}>{saving?'저장 중…':'페이지 저장'}</Button></div>
 {error&&<p role="alert">{error}</p>}
 <div className="journal-tools"><label>분류 <select aria-label="기록 분류" value={draft.kind} onChange={e=>change({kind:e.target.value as EntrySnapshot['kind']})}><option value="life">일상</option><option value="investment">투자</option></select></label>
 <Popover.Root open={financeOpen} onOpenChange={setFinanceOpen}><Popover.Trigger asChild><Button variant="secondary" aria-label="Financial 정보 불러오기">@ Financial</Button></Popover.Trigger><Popover.Portal><Popover.Content className="journal-financial-popover" sideOffset={8} align="start" aria-label="Financial 선택">
  <strong>Financial · 공시 정보</strong><input autoFocus aria-label="Financial 종목 검색" placeholder="종목명 또는 Ticker 검색" value={financialQuery} onChange={e=>setFinancialQuery(e.target.value)}/>
  <div className="journal-financial-options">{financials.filter(f=>(f.label+' '+f.ticker).toLowerCase().includes(financialQuery.toLowerCase())).slice(0,30).map(f=><button key={f.ticker} type="button" onClick={()=>{change({kind:'investment',ticker:f.ticker});setSnippet({id:Date.now(),text:f.summary});setFinanceOpen(false)}}><b>{f.label}</b><small>{f.ticker}</small></button>)}</div>
  {!financials.length&&<p>연결된 공시 Financial 자료가 없습니다.</p>}
 </Popover.Content></Popover.Portal></Popover.Root></div>
 <NotebookEditor insertSnippet={snippet} onMentionRequest={()=>setFinanceOpen(true)} value={{body:draft.body,text:draft.text,ink:draft.ink,photos:entryPhotos(draft),paper:draft.paper}} onBusy={busy=>{setPhotoBusy(busy);if(busy)onDirty(true)}} onChange={patch=>change({...patch,...(patch.photos?{photo:patch.photos[0]}:{})})}/>
 {draft.kind==='investment'&&<section className="journal-investment-fields" aria-label="투자 판단"><label>내 가설<textarea aria-label="내 가설" value={draft.hypothesis||''} placeholder="어떤 변화가 이 기업의 가치로 이어질까요?" onChange={e=>change({hypothesis:e.target.value})}/></label><label>반대 증거<textarea aria-label="반대 증거" value={draft.counterEvidence||''} placeholder="어떤 사실이 이 가설을 반박하나요?" onChange={e=>change({counterEvidence:e.target.value})}/></label></section>}
 <details className="journal-extras"><summary>장소 · 소비 · 종목 연결</summary><div className="journal-field-grid"><label>장소<input value={draft.place} onChange={e=>change({place:e.target.value})}/></label><label>지출 금액<input type="number" min="0" step="0.01" value={draft.expense} onChange={e=>change({expense:e.target.value})}/></label><label>통화<select value={draft.currency} onChange={e=>change({currency:e.target.value})}><option>KRW</option><option>USD</option><option>EUR</option></select></label><label>관련 종목<input placeholder="예: KR:005930 / US:NVDA" value={draft.ticker} onChange={e=>change({ticker:e.target.value})}/></label></div></details>
 <details className="journal-ai-disclosure"><summary>AI와 대화하기</summary><JournalAI session={session} messages={draft.aiMessages||[]} onChange={messages=>change({aiMessages:messages})} context={[draft.title,draft.ticker,draft.hypothesis,draft.counterEvidence,draft.text].filter(Boolean).join('\n\n')}/></details>
 </div><details className="journal-questions" open={!!(initialQuestion||entry?.answer||entry?.reviewDate)}><summary>생각을 정리하는 질문</summary><div className="journal-question-content"><span className="journey-kicker">생각을 넓히는 질문</span><label>오늘의 질문<select aria-label="오늘의 질문" value={draft.question} onChange={e=>change({question:e.target.value})}>{[...new Set([...questions,draft.question])].map(q=><option key={q}>{q}</option>)}</select></label><h3>{draft.question}</h3><textarea aria-label="질문에 대한 나의 답" placeholder="지금의 생각을 남겨보세요. 답은 나중에 이어 써도 괜찮습니다." value={draft.answer} onChange={e=>change({answer:e.target.value})}/><label>다음 점검일<input type="date" value={draft.reviewDate} onChange={e=>change({reviewDate:e.target.value})}/></label><p>이전 판단은 수정 이력에 남습니다. 결과와 당시의 판단을 나란히 돌아보세요.</p>
 {entry?.revisions.length? <details><summary>이전 생각 {entry.revisions.length}개</summary>{entry.revisions.slice().reverse().map((r,i)=><article className="journal-revision" key={i}><time>{new Date(r.at).toLocaleString('ko-KR')}</time><b>{r.snapshot.title}</b>{r.snapshot.hypothesis&&<p>내 가설 · {r.snapshot.hypothesis}</p>}{r.snapshot.counterEvidence&&<p>반대 증거 · {r.snapshot.counterEvidence}</p>}<p>{r.snapshot.text}</p><p>{r.snapshot.answer}</p></article>)}</details>:null}
 <small>{storageLabel} · 사진, 필기, 수정 이력이 함께 보관됩니다.</small></div></details></div>
}
