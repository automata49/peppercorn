import { useState, useRef } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Button } from './ui/button'
import { InkPad } from './InkPad'
import { blankSnapshot, cleanDocument, questions, snapshot, type JournalEntry, type EntrySnapshot } from '../lib/lifetimeJournal'
async function photoData(file:File){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>15000000)throw Error('15MB 이하의 JPG, PNG, WebP 사진을 선택하세요.')
 const bitmap=await createImageBitmap(file)
 const scale=Math.min(1,1400/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale)
 const ctx=canvas.getContext('2d');if(!ctx){bitmap.close();throw Error('사진을 처리할 수 없습니다.')};ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();return canvas.toDataURL('image/jpeg',.82)
}
export default function JournalEditor({entry,initialQuestion,onSave,onDirty}:{entry?:JournalEntry;initialQuestion?:string;onSave:(e:JournalEntry)=>Promise<void>;onDirty:(v:boolean)=>void}){
 const [draft,setDraft]=useState<EntrySnapshot>(()=>entry?snapshot(entry):{...blankSnapshot(),...(initialQuestion?{question:initialQuestion}:{})})
 const [saving,setSaving]=useState(false),[error,setError]=useState(''),[photoBusy,setPhotoBusy]=useState(false)
 const photoGeneration=useRef(0)
 function change(p:Partial<EntrySnapshot>){setDraft(d=>({...d,...p}));onDirty(true)}
 const editor=useEditor({extensions:[StarterKit.configure({link:false})],content:cleanDocument(draft.body),editorProps:{attributes:{class:'journal-prose',role:'textbox','aria-label':'기록 본문','aria-multiline':'true'}},onUpdate:({editor})=>change({body:editor.getJSON(),text:editor.getText()})})
 async function save(){
  if(!draft.title.trim()){setError('기록의 제목을 입력하세요.');return}
  setSaving(true);setError('')
  const now=new Date().toISOString()
  try{await onSave({...draft,title:draft.title.trim(),id:entry?.id||crypto.randomUUID(),createdAt:entry?.createdAt||now,updatedAt:now,revisions:entry?[...entry.revisions,{at:entry.updatedAt,snapshot:snapshot(entry)}]:[]});onDirty(false)}catch(e){setError((e as Error)?.message||'저장하지 못했습니다. 기록을 닫지 말고 저장 공간을 확인한 뒤 다시 시도하세요.')}finally{setSaving(false)}
 }
 return <div className="journal-editor" aria-busy={saving} inert={saving}>
 <div className="journal-editor-main">
 <label className="sr-only" htmlFor="journal-title">기록 제목</label><input id="journal-title" className="journal-title-input" placeholder="오늘의 한 페이지" maxLength={160} value={draft.title} onChange={e=>change({title:e.target.value})}/>
 <div className="journal-tools"><label>분류 <select aria-label="기록 분류" value={draft.kind} onChange={e=>change({kind:e.target.value as EntrySnapshot['kind']})}><option value="life">일상</option><option value="investment">투자</option></select></label><label className="folio-button folio-button-secondary">{photoBusy?'사진 준비 중…':'사진 추가'}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="기록 사진" disabled={photoBusy} onChange={async e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;const generation=++photoGeneration.current;setPhotoBusy(true);try{const photo=await photoData(f);if(generation===photoGeneration.current)change({photo})}catch(err){setError(String((err as Error).message))}finally{setPhotoBusy(false)}}}/></label>{draft.photo&&<Button variant="ghost" onClick={()=>change({photo:undefined})}>사진 빼기</Button>}</div>
 {draft.photo&&<img className="journal-cover" src={draft.photo} alt="기록에 첨부한 사진"/>}
 <div className="journal-format" role="toolbar" aria-label="문서 서식"><Button variant="ghost" aria-pressed={editor?.isActive('bold')} onClick={()=>editor?.chain().focus().toggleBold().run()}>굵게</Button><Button variant="ghost" onClick={()=>editor?.chain().focus().toggleHeading({level:2}).run()}>소제목</Button><Button variant="ghost" onClick={()=>editor?.chain().focus().toggleBulletList().run()}>목록</Button><Button variant="ghost" onClick={()=>editor?.chain().focus().toggleBlockquote().run()}>인용</Button></div>
 <EditorContent editor={editor}/>
 <InkPad strokes={draft.ink} onChange={ink=>change({ink})}/>
 <details className="journal-extras"><summary>장소 · 소비 · 종목 연결</summary><div className="journal-field-grid"><label>장소<input value={draft.place} onChange={e=>change({place:e.target.value})}/></label><label>지출 금액<input type="number" min="0" step="0.01" value={draft.expense} onChange={e=>change({expense:e.target.value})}/></label><label>통화<select value={draft.currency} onChange={e=>change({currency:e.target.value})}><option>KRW</option><option>USD</option><option>EUR</option></select></label><label>관련 종목<input placeholder="예: KR:005930 / US:NVDA" value={draft.ticker} onChange={e=>change({ticker:e.target.value})}/></label></div></details>
 </div><aside className="journal-questions"><span className="journey-kicker">생각을 넓히는 질문</span><label>오늘의 질문<select aria-label="오늘의 질문" value={draft.question} onChange={e=>change({question:e.target.value})}>{[...new Set([...questions,draft.question])].map(q=><option key={q}>{q}</option>)}</select></label><h3>{draft.question}</h3><textarea aria-label="질문에 대한 나의 답" placeholder="지금의 생각을 남겨보세요. 답은 나중에 이어 써도 괜찮습니다." value={draft.answer} onChange={e=>change({answer:e.target.value})}/><label>다음 점검일<input type="date" value={draft.reviewDate} onChange={e=>change({reviewDate:e.target.value})}/></label><p>이전 판단은 수정 이력에 남습니다. 결과와 당시의 판단을 나란히 돌아보세요.</p>
 {entry?.revisions.length? <details><summary>이전 생각 {entry.revisions.length}개</summary>{entry.revisions.slice().reverse().map((r,i)=><article className="journal-revision" key={i}><time>{new Date(r.at).toLocaleString('ko-KR')}</time><b>{r.snapshot.title}</b><p>{r.snapshot.text}</p><p>{r.snapshot.answer}</p></article>)}</details>:null}
 <small>이 브라우저의 기기에 저장됩니다. 다른 기기로 옮기려면 저널에서 백업을 내보내세요.</small><Button disabled={saving||photoBusy} onClick={()=>void save()}>{saving?'저장 중…':'페이지 저장'}</Button>{error&&<p role="alert">{error}</p>}</aside></div>
}
