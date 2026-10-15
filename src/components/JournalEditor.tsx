import { useState, useRef } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Button } from './ui/button'
import { InkPad } from './InkPad'
import { blankSnapshot, cleanDocument, entryPhotos, questions, snapshot, type JournalEntry, type EntrySnapshot } from '../lib/lifetimeJournal'
async function photoData(file:File){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>15000000)throw Error('15MB 이하의 JPG, PNG, WebP 사진을 선택하세요.')
 const bitmap=await createImageBitmap(file)
 const scale=Math.min(1,1400/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale)
 const ctx=canvas.getContext('2d');if(!ctx){bitmap.close();throw Error('사진을 처리할 수 없습니다.')};ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();return canvas.toDataURL('image/jpeg',.82)
}
export default function JournalEditor({entry,initialQuestion,onSave,onDirty,storageLabel='이 기기에 보관한 기록'}:{storageLabel?:string;entry?:JournalEntry;initialQuestion?:string;onSave:(e:JournalEntry)=>Promise<void>;onDirty:(v:boolean)=>void}){
 const [draft,setDraft]=useState<EntrySnapshot>(()=>entry?snapshot(entry):{...blankSnapshot(),...(initialQuestion?{question:initialQuestion}:{})})
 const [saving,setSaving]=useState(false),[error,setError]=useState(''),[photoBusy,setPhotoBusy]=useState(false)
 const photoGeneration=useRef(0)
 function change(p:Partial<EntrySnapshot>){setDraft(d=>({...d,...p}));onDirty(true)}
 const photos=entryPhotos(draft)
 async function addPhotos(files:File[]){
  if(photos.length+files.length>4){setError('사진은 한 페이지에 최대 4장까지 추가할 수 있습니다.');return}
  const generation=++photoGeneration.current;setPhotoBusy(true);setError('')
  try{const added=await Promise.all(files.map(photoData));if(added.some(p=>p.length>=3000000))throw Error('사진 크기를 줄여 다시 추가하세요.');if(generation===photoGeneration.current){const next=[...photos,...added];change({photos:next,photo:next[0]})}}catch(err){setError((err as Error).message)}finally{setPhotoBusy(false)}
 }
 const editor=useEditor({shouldRerenderOnTransaction:true,extensions:[StarterKit.configure({link:false})],content:cleanDocument(draft.body),editorProps:{attributes:{class:'journal-prose',role:'textbox','aria-label':'기록 본문','aria-multiline':'true'}},onUpdate:({editor})=>change({body:editor.getJSON(),text:editor.getText()})})
 async function save(){
  if(!draft.title.trim()){setError('기록의 제목을 입력하세요.');return}
  setSaving(true);setError('')
  const now=new Date().toISOString()
  try{await onSave({...draft,title:draft.title.trim(),id:entry?.id||crypto.randomUUID(),createdAt:entry?.createdAt||now,updatedAt:now,revisions:entry?[...entry.revisions,{at:entry.updatedAt,snapshot:snapshot(entry)}]:[]});onDirty(false)}catch(e){setError((e as Error)?.message||'저장하지 못했습니다. 기록을 닫지 말고 저장 공간을 확인한 뒤 다시 시도하세요.')}finally{setSaving(false)}
 }
 return <div className="journal-editor" aria-busy={saving} inert={saving}>
 <div className="journal-editor-main">
 <label className="sr-only" htmlFor="journal-title">기록 제목</label><input id="journal-title" className="journal-title-input" placeholder="오늘의 한 페이지" maxLength={160} value={draft.title} onChange={e=>change({title:e.target.value})}/>
 <div className="journal-tools"><label>분류 <select aria-label="기록 분류" value={draft.kind} onChange={e=>change({kind:e.target.value as EntrySnapshot['kind']})}><option value="life">일상</option><option value="investment">투자</option></select></label><label className="folio-button folio-button-secondary">{photoBusy?'사진 준비 중…':'사진 추가'}<input type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="기록 사진" disabled={photoBusy} onChange={e=>{const files=Array.from(e.target.files||[]);e.target.value='';if(files.length)void addPhotos(files)}}/></label>{photos.length>0&&<Button variant="ghost" disabled={photoBusy} onClick={()=>change({photo:undefined,photos:[]})}>사진 빼기</Button>}</div>
 {photos.length>0&&<div className="journal-photo-collage" aria-label="기록 사진 모음">{photos.map((photo,i)=><figure key={i}><img className="journal-cover" src={photo} alt={i===0?'기록에 첨부한 사진':`기록 사진 ${i+1}`}/><Button variant="secondary" disabled={photoBusy} aria-label={`사진 ${i+1} 삭제`} onClick={()=>{const next=photos.filter((_,index)=>index!==i);change({photos:next,photo:next[0]})}}>삭제</Button></figure>)}</div>}
 {draft.kind==='investment'&&<section className="journal-investment-fields" aria-label="투자 판단"><label>내 가설<textarea aria-label="내 가설" value={draft.hypothesis||''} placeholder="어떤 변화가 이 기업의 가치로 이어질까요?" onChange={e=>change({hypothesis:e.target.value})}/></label><label>반대 증거<textarea aria-label="반대 증거" value={draft.counterEvidence||''} placeholder="어떤 사실이 이 가설을 반박하나요?" onChange={e=>change({counterEvidence:e.target.value})}/></label></section>}
 <div className="journal-format" role="toolbar" aria-label="문서 서식">{[
  {label:'굵게',active:editor?.isActive('bold'),run:()=>editor?.chain().focus().toggleBold().run()},
  {label:'기울임',active:editor?.isActive('italic'),run:()=>editor?.chain().focus().toggleItalic().run()},
  {label:'밑줄',active:editor?.isActive('underline'),run:()=>editor?.chain().focus().toggleUnderline().run()},
  {label:'취소선',active:editor?.isActive('strike'),run:()=>editor?.chain().focus().toggleStrike().run()},
  {label:'소제목',active:editor?.isActive('heading',{level:2}),run:()=>editor?.chain().focus().toggleHeading({level:2}).run()},
  {label:'목록',active:editor?.isActive('bulletList'),run:()=>editor?.chain().focus().toggleBulletList().run()},
  {label:'번호 목록',active:editor?.isActive('orderedList'),run:()=>editor?.chain().focus().toggleOrderedList().run()},
  {label:'인용',active:editor?.isActive('blockquote'),run:()=>editor?.chain().focus().toggleBlockquote().run()},
  {label:'코드',active:editor?.isActive('codeBlock'),run:()=>editor?.chain().focus().toggleCodeBlock().run()},
 ].map(tool=><Button key={tool.label} variant="ghost" aria-pressed={!!tool.active} onMouseDown={e=>e.preventDefault()} onClick={tool.run}>{tool.label}</Button>)}<Button variant="ghost" disabled={!editor?.can().undo()} onClick={()=>editor?.chain().focus().undo().run()}>실행 취소</Button><Button variant="ghost" disabled={!editor?.can().redo()} onClick={()=>editor?.chain().focus().redo().run()}>다시 실행</Button></div>
 <EditorContent editor={editor}/><p className="journal-editor-status" aria-live="polite">{draft.text.length.toLocaleString()}자 · Markdown 단축 입력 지원</p>
 <details className="journal-extras" open={!!entry?.ink.length}><summary>손글씨 추가</summary><InkPad strokes={draft.ink} onChange={ink=>change({ink})}/></details>
 <details className="journal-extras"><summary>장소 · 소비 · 종목 연결</summary><div className="journal-field-grid"><label>장소<input value={draft.place} onChange={e=>change({place:e.target.value})}/></label><label>지출 금액<input type="number" min="0" step="0.01" value={draft.expense} onChange={e=>change({expense:e.target.value})}/></label><label>통화<select value={draft.currency} onChange={e=>change({currency:e.target.value})}><option>KRW</option><option>USD</option><option>EUR</option></select></label><label>관련 종목<input placeholder="예: KR:005930 / US:NVDA" value={draft.ticker} onChange={e=>change({ticker:e.target.value})}/></label></div></details>
 </div><details className="journal-questions" open={!!(initialQuestion||entry?.answer||entry?.reviewDate)}><summary>생각을 정리하는 질문</summary><div className="journal-question-content"><span className="journey-kicker">생각을 넓히는 질문</span><label>오늘의 질문<select aria-label="오늘의 질문" value={draft.question} onChange={e=>change({question:e.target.value})}>{[...new Set([...questions,draft.question])].map(q=><option key={q}>{q}</option>)}</select></label><h3>{draft.question}</h3><textarea aria-label="질문에 대한 나의 답" placeholder="지금의 생각을 남겨보세요. 답은 나중에 이어 써도 괜찮습니다." value={draft.answer} onChange={e=>change({answer:e.target.value})}/><label>다음 점검일<input type="date" value={draft.reviewDate} onChange={e=>change({reviewDate:e.target.value})}/></label><p>이전 판단은 수정 이력에 남습니다. 결과와 당시의 판단을 나란히 돌아보세요.</p>
 {entry?.revisions.length? <details><summary>이전 생각 {entry.revisions.length}개</summary>{entry.revisions.slice().reverse().map((r,i)=><article className="journal-revision" key={i}><time>{new Date(r.at).toLocaleString('ko-KR')}</time><b>{r.snapshot.title}</b>{r.snapshot.hypothesis&&<p>내 가설 · {r.snapshot.hypothesis}</p>}{r.snapshot.counterEvidence&&<p>반대 증거 · {r.snapshot.counterEvidence}</p>}<p>{r.snapshot.text}</p><p>{r.snapshot.answer}</p></article>)}</details>:null}
 <small>{storageLabel} · 사진, 필기, 수정 이력이 함께 보관됩니다.</small></div></details><footer className="journal-save"><Button disabled={saving||photoBusy} onClick={()=>void save()}>{saving?'저장 중…':'페이지 저장'}</Button>{error&&<p role="alert">{error}</p>}</footer></div>
}
