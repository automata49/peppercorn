import {lazy,Suspense,useState} from 'react'
import {Button} from './ui/button'
const NotebookEditor=lazy(()=>import('./NotebookEditor').then(module=>({default:module.NotebookEditor})))
import {InkPreview} from './InkPad'
import {NotebookReadOnly} from './NotebookReadOnly'
import {snapshot,type JournalEntry,type Reflection,type NotebookNote} from '../lib/lifetimeJournal'
export function reviewStatus(entry:JournalEntry,today=new Date().toLocaleDateString('sv-SE')){
 return entry.reviewDate&&entry.reviewDate<=today?'due':entry.reflections?.length?'done':'planned'
}
export const reviewLabels={due:'점검할 판단',planned:'점검 예정',done:'회고 완료'}
export function ReflectionPanel({entry,onSave,onDirty}:{entry:JournalEntry;onDirty:(dirty:boolean)=>void;onSave:(entry:JournalEntry)=>Promise<void>}){
 const [result,setResult]=useState(''),[lesson,setLesson]=useState(''),[nextAction,setNextAction]=useState(''),[outcome,setOutcome]=useState<Reflection['outcome']>('maintain'),[reviewDate,setReviewDate]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const [note,setNote]=useState<NotebookNote>({body:{type:'doc',content:[{type:'paragraph'}]},text:'',ink:[],photos:[]}),[photoBusy,setPhotoBusy]=useState(false)
 const original=entry.revisions[0]?.snapshot||entry
 async function save(){
  if(!result.trim()||!lesson.trim()){setError('확인한 결과와 배운 점을 남겨주세요.');return}
  setBusy(true);setError('')
  const at=new Date().toISOString()
  try{await onSave({...entry,reviewDate,updatedAt:at,reflections:[...(entry.reflections||[]),{at,outcome,result:result.trim(),lesson:lesson.trim(),nextAction:nextAction.trim(),note}],revisions:[...entry.revisions,{at:entry.updatedAt,snapshot:snapshot(entry)}]})}catch(error){setError((error as Error).message)}finally{setBusy(false)}
 }
 return <section className="reflection-panel" aria-label="투자 판단 회고">
  <div className="notebook-heading"><h3>{entry.title}</h3><Button disabled={busy||photoBusy} onClick={()=>void save()}>{busy?'회고 저장 중…':'회고 저장'}</Button></div>
  <details className="notebook-meta"><summary>그때와 지금의 판단</summary>
  <div className="journey-judgement"><section><h4>그때의 가설</h4><p>{original.hypothesis||original.text||original.answer||'가설을 따로 기록하지 않았습니다.'}</p><h5>당시의 반대 증거</h5><p>{original.counterEvidence||'남긴 반대 증거가 없습니다.'}</p></section><section><h4>지금의 판단</h4><p>{entry.hypothesis||entry.text||entry.answer||'판단을 남겨보세요.'}</p><h5>최근 반대 증거</h5><p>{entry.counterEvidence||'새로운 증거를 회고에 남겨보세요.'}</p></section></div>
  </details>
  {!!entry.reflections?.length&&<details><summary>지난 회고 {entry.reflections.length}개</summary>{entry.reflections.slice().reverse().map(r=><article className="journal-revision" key={r.at}><time>{new Date(r.at).toLocaleDateString('ko-KR')}</time><b>{r.outcome==='maintain'?'판단 유지':r.outcome==='revise'?'판단 수정':'검토 종료'}</b><p>{r.result}</p><p>배운 점 · {r.lesson}</p>{r.nextAction&&<p>다음 행동 · {r.nextAction}</p>}{r.note&&<><NotebookReadOnly body={r.note.body}/>{r.note.photos.map((photo,i)=><img key={i} className="journal-cover" src={photo} alt={`회고 사진 ${i+1}`}/>)}{r.note.ink.length>0&&<InkPreview strokes={r.note.ink}/>}</>}</article>)}</details>}
  <div inert={busy}><Suspense fallback={<p role="status">편집기를 여는 중…</p>}><NotebookEditor value={note} label="회고 노트 본문" onBusy={busy=>{setPhotoBusy(busy);if(busy)onDirty(true)}} onChange={patch=>{setNote(n=>({...n,...patch}));onDirty(true)}}><fieldset disabled={busy} onChange={()=>onDirty(true)}><legend>새 회고</legend><label>판단의 변화<select aria-label="회고 판단" value={outcome} onChange={e=>setOutcome(e.target.value as Reflection['outcome'])}><option value="maintain">판단 유지</option><option value="revise">판단 수정</option><option value="close">검토 종료</option></select></label><label>확인한 결과와 새 증거<textarea aria-label="회고 결과" value={result} onChange={e=>setResult(e.target.value)} placeholder="예상했던 변화가 실제로 나타났나요?"/></label><label>배운 점<textarea aria-label="회고 배운 점" value={lesson} onChange={e=>setLesson(e.target.value)} placeholder="결과와 별개로, 당시 결정에서 배울 점은 무엇인가요?"/></label><label>다음 행동<textarea aria-label="회고 다음 행동" value={nextAction} onChange={e=>setNextAction(e.target.value)}/></label><label>다음 점검일<input aria-label="회고 다음 점검일" type="date" value={reviewDate} onChange={e=>setReviewDate(e.target.value)}/></label></fieldset><h4>자유 노트</h4></NotebookEditor></Suspense></div>{error&&<p role="alert">{error}</p>}
 </section>
}
