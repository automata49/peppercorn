import {lazy,Suspense,useState} from 'react'
import {Button} from './ui/button'
import {InkPreview} from './InkPad'
import {NotebookReadOnly} from './NotebookReadOnly'
import {snapshot,type JournalEntry,type Reflection,type NotebookNote} from '../lib/lifetimeJournal'
import {currentJudgement,latestReview} from '../lib/decisionReview'
export {reviewStatus,reviewLabels} from '../lib/decisionReview'
const NotebookEditor=lazy(()=>import('./NotebookEditor').then(module=>({default:module.NotebookEditor})))
export function ReflectionPanel({entry,onSave,onDirty}:{entry:JournalEntry;onDirty:(dirty:boolean)=>void;onSave:(entry:JournalEntry)=>Promise<void>}){
 const previous=currentJudgement(entry),last=latestReview(entry),today=new Date().toLocaleDateString('sv-SE')
 const [result,setResult]=useState(''),[judgement,setJudgement]=useState(previous),[lesson,setLesson]=useState(''),[nextAction,setNextAction]=useState(''),[trigger,setTrigger]=useState(last?.trigger||''),[outcome,setOutcome]=useState<Reflection['outcome']>('maintain'),[reviewDate,setReviewDate]=useState(entry.reviewDate>=today?entry.reviewDate:''),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const [note,setNote]=useState<NotebookNote>({body:{type:'doc',content:[{type:'paragraph'}]},text:'',ink:[],photos:[]}),[photoBusy,setPhotoBusy]=useState(false)
 const original=entry.revisions[0]?.snapshot||entry
 function changed(){onDirty(true);setError('')}
 async function save(){
  if(!result.trim()){setError('이번에 새로 확인한 증거를 남겨주세요.');return}
  if(outcome==='revise'&&(!judgement.trim()||judgement.trim()===previous)){setError('수정한 판단을 이전 판단과 다르게 한 문장으로 남겨주세요.');return}
  if(outcome!=='close'&&!trigger.trim()&&!reviewDate){setError('다시 점검할 조건이나 날짜 중 하나를 정해주세요.');return}
  setBusy(true);setError('');const at=new Date().toISOString()
  const hasNote=note.text.trim()||note.ink.length||note.photos.length||note.paper||note.body.content?.some(n=>n.type!=='paragraph'||n.content?.length)
  const review:Reflection={at,outcome,result:result.trim(),lesson:lesson.trim(),nextAction:nextAction.trim(),previousJudgement:previous,judgement:outcome==='revise'?judgement.trim():previous,trigger:outcome==='close'?'':trigger.trim(),nextReviewDate:outcome==='close'?'':reviewDate,...(hasNote?{note}:{})}
  try{await onSave({...entry,reviewDate:outcome==='close'?'':reviewDate,updatedAt:at,reflections:[...(entry.reflections||[]),review],revisions:[...entry.revisions,{at:entry.updatedAt,snapshot:snapshot(entry)}]})}catch(error){setError((error as Error).message)}finally{setBusy(false)}
 }
 return <section className="reflection-panel decision-review" aria-label="투자 판단 회고">
  <div className="notebook-heading"><h3>{entry.title}</h3><Button disabled={busy||photoBusy} onClick={()=>void save()}>{busy?'판단 저장 중…':'판단 저장'}</Button></div>
  {error&&<p role="alert">{error}</p>}
  <div inert={busy}>
   <aside className="decision-context" aria-label="이번 점검의 기준"><span>직전 판단 · {new Date(last?.at||entry.updatedAt).toLocaleDateString('ko-KR')}</span><p>{previous||'별도로 남긴 가설이 없습니다. 새 증거를 확인하고 판단을 정리하세요.'}</p>{last?.trigger&&<small>점검 조건 · {last.trigger}</small>}</aside>
   <div className="decision-review-steps" onChange={changed}>
    <section aria-labelledby="review-evidence-heading"><h4 id="review-evidence-heading"><span>01</span> 새 증거</h4><label>이번에 달라진 사실<textarea aria-label="회고 결과" value={result} onChange={e=>setResult(e.target.value)} placeholder="어떤 사실을 새로 확인했나요? 예상과 달랐던 점은 무엇인가요?"/></label>
     <details className="decision-notes"><summary>증거 노트 · 사진·필기</summary><Suspense fallback={<p role="status">편집기를 여는 중…</p>}><NotebookEditor value={note} label="회고 노트 본문" onBusy={v=>{setPhotoBusy(v);if(v)changed()}} onChange={patch=>{setNote(n=>({...n,...patch}));changed()}}/></Suspense></details>
    </section>
    <section aria-labelledby="review-decision-heading"><h4 id="review-decision-heading"><span>02</span> 지금의 판단</h4><label>판단의 변화<select aria-label="회고 판단" value={outcome} onChange={e=>setOutcome(e.target.value as Reflection['outcome'])}><option value="maintain">판단 유지</option><option value="revise">판단 수정</option><option value="close">검토 종료</option></select></label>
     {outcome==='revise'?<label>바뀐 판단 한 문장<textarea aria-label="바뀐 판단" value={judgement} onChange={e=>setJudgement(e.target.value)} placeholder="새 증거를 반영한 판단을 남겨주세요."/></label>:<p className="decision-outcome-note">{outcome==='close'?'이번 검토를 종료하고 다음 점검 대기열에서 제외합니다.':'직전 판단을 유지합니다. 판단 문장을 다시 쓸 필요가 없습니다.'}</p>}
     <details><summary>배운 점 남기기 · 선택</summary><label>배운 점<textarea aria-label="회고 배운 점" value={lesson} onChange={e=>setLesson(e.target.value)}/></label></details>
    </section>
    <section aria-labelledby="review-next-heading"><h4 id="review-next-heading"><span>03</span> 다음 점검</h4>{outcome==='close'?<p className="decision-outcome-note">다음 점검은 잡지 않습니다. 기록과 판단 이력은 남습니다.</p>:<><p>조건이나 날짜 중 하나만 정해도 됩니다. 조건 충족 여부는 직접 확인합니다.</p><label>다시 확인할 조건<textarea aria-label="다음 점검 조건" value={trigger} onChange={e=>setTrigger(e.target.value)} placeholder="어떤 변화가 생기면 이 판단을 다시 확인할까요?"/></label><label>다음 점검일<input aria-label="회고 다음 점검일" type="date" value={reviewDate} onChange={e=>setReviewDate(e.target.value)}/></label></>}
     <details><summary>다음에 할 일 · 선택</summary><label>다음 행동<textarea aria-label="회고 다음 행동" value={nextAction} onChange={e=>setNextAction(e.target.value)}/></label></details>
    </section>
   </div>
   <details className="decision-history"><summary>원본·판단 이력 {entry.reflections?.length||0}회</summary><article className="journal-revision"><time>{new Date(entry.createdAt).toLocaleDateString('ko-KR')}</time><b>처음 남긴 판단</b><p>{original.hypothesis||original.text||original.answer||'별도 가설 없음'}</p>{original.counterEvidence&&<p>반대 증거 · {original.counterEvidence}</p>}</article>
    {entry.reflections?.slice().reverse().map((r,i)=><article className="journal-revision" key={r.at+'-'+i}><time>{new Date(r.at).toLocaleString('ko-KR')}</time><b>{r.outcome==='maintain'?'판단 유지':r.outcome==='revise'?'판단 수정':'검토 종료'}</b>{r.previousJudgement&&r.judgement!==r.previousJudgement&&<p>이전 판단 · {r.previousJudgement}</p>}{r.judgement&&<p>판단 · {r.judgement}</p>}<p>새 증거 · {r.result}</p>{r.lesson&&<p>배운 점 · {r.lesson}</p>}{r.trigger&&<p>다음 조건 · {r.trigger}</p>}{r.nextReviewDate&&<p>다음 점검일 · {r.nextReviewDate}</p>}{r.nextAction&&<p>다음 행동 · {r.nextAction}</p>}{r.note&&<><NotebookReadOnly body={r.note.body}/>{r.note.photos.map((photo,i)=><img key={i} className="journal-cover" src={photo} alt={`회고 사진 ${i+1}`}/>)}{r.note.ink.length>0&&<InkPreview strokes={r.note.ink}/>}</>}</article>)}
   </details>
  </div>
 </section>
}
