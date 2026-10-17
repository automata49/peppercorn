import {useEffect,useRef,useState,type ReactNode,type PointerEvent as ReactPointerEvent} from 'react'
import {EditorContent,useEditor,type Editor,type JSONContent} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {AppIcon,type AppIconName} from './AppIcon'
import {Button} from './ui/button'
import {cleanDocument,type InkPoint,type InkStroke} from '../lib/lifetimeJournal'
import {inkBounds,inkColor,inkColors,inkPath,nearStroke,type InkColor,type PaperStyle} from '../lib/notebookInk'
import '../design/notebook.css'
export type NotebookContent={body:JSONContent;text:string;ink:InkStroke[];photos:string[];paper?:PaperStyle}
type Tool='text'|'pen'|'pencil'|'highlighter'|'eraser'|'selection'
type AICommand={from:number;to:number;question:string}
const tools:{id:Tool;label:string;icon:AppIconName}[]=[{id:'pen',label:'펜',icon:'pen'},{id:'pencil',label:'연필',icon:'pencil'},{id:'highlighter',label:'형광펜',icon:'highlighter'},{id:'eraser',label:'지우개',icon:'eraser'},{id:'selection',label:'영역 선택',icon:'selection'},{id:'text',label:'텍스트',icon:'text'}]
async function photoData(file:File){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>15000000)throw Error('15MB 이하의 JPG, PNG, WebP 사진을 선택하세요.')
 const bitmap=await createImageBitmap(file),scale=Math.min(1,1400/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas')
 canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale)
 const ctx=canvas.getContext('2d');if(!ctx){bitmap.close();throw Error('사진을 처리할 수 없습니다.')}
 ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();return canvas.toDataURL('image/jpeg',.82)
}
export function NotebookEditor({value,onChange,label='기록 본문',children,onBusy,insertSnippet,onAIRequest}:{value:NotebookContent;onChange:(patch:Partial<NotebookContent>)=>void;label?:string;children?:ReactNode;onBusy?:(busy:boolean)=>void;insertSnippet?:{id:number;text:string};onAIRequest?:(question:string,context:string)=>Promise<string>}){
 const [tool,setTool]=useState<Tool>('text'),[color,setColor]=useState<InkColor>('ink'),[size,setSize]=useState(5),[finger,setFinger]=useState(false),[settings,setSettings]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const [aiCommand,setAICommand]=useState<AICommand|null>(null),[aiBusy,setAIBusy]=useState(false),[aiError,setAIError]=useState('')
 const [drawing,setDrawing]=useState<InkStroke>([]),[selection,setSelection]=useState<number[]>([]),[selectionRect,setSelectionRect]=useState<{x:number;y:number;right:number;bottom:number}|null>(null),[height,setHeight]=useState(1400),[paperWidth,setPaperWidth]=useState(0)
 const [,refresh]=useState(0),history=useRef<{past:InkStroke[][];future:InkStroke[][]}>({past:[],future:[]})
 const paper=useRef<HTMLDivElement>(null),photoInput=useRef<HTMLInputElement>(null),latest=useRef(value),changeRef=useRef(onChange),aiRequestRef=useRef(onAIRequest),aiBusyRef=useRef(false),mounted=useRef(true)
 latest.current=value;changeRef.current=onChange;aiRequestRef.current=onAIRequest
 const pan=useRef<{id:number;y:number;top:number;node:HTMLElement}|null>(null)
 const active=useRef<{id:number;start:InkPoint;points:InkStroke;before:InkStroke[];next:InkStroke[];kind:Tool|'move';selection:number[]}|null>(null)
 function activeAICommand(instance:Editor):AICommand|null{
  if(!aiRequestRef.current||!instance.state.selection.empty)return null
  const {$from}=instance.state.selection
  const paragraph=$from.parent.textContent
  const at=paragraph.lastIndexOf('@')
  if(at<0||$from.parentOffset<at)return null
  const after=paragraph.slice(at+1)
  if(after.length>1800||after.includes('\n'))return null
  // Full paragraph range accommodates IME and contenteditable caret quirks.
  return {from:$from.start()+at,to:$from.start()+paragraph.length,question:after.replace(/^\s*(?:AI\s+)?/i,'').trim()}
 }
 async function submitAI(instance:Editor,command:AICommand){
  if(aiBusyRef.current||!aiRequestRef.current||!command.question)return
  aiBusyRef.current=true;setAIBusy(true);setAIError('');onBusy?.(true)
  instance.setEditable(false)
  try{
   const response=await aiRequestRef.current(command.question,latest.current.text)
   if(!mounted.current)return
   const lines=response.split(/\\r?\\n/).filter(line=>line.trim()).slice(0,80)
   const content=[{type:'paragraph',content:[{type:'text',text:'AI 초안 · 확인 후 수정'}]},...lines.map(line=>({type:'paragraph',content:[{type:'text',text:line.slice(0,4000)}]}))]
   instance.commands.insertContentAt({from:command.from,to:command.to},{type:'blockquote',content})
   setAICommand(null)
  }catch(e){if(mounted.current)setAIError((e as Error).message)}
  finally{
   aiBusyRef.current=false
   if(mounted.current){instance.setEditable(true);setAIBusy(false);onBusy?.(false);instance.commands.focus()}
  }
 }
 const editor=useEditor({shouldRerenderOnTransaction:true,extensions:[StarterKit.configure({link:false})],content:cleanDocument(value.body),editorProps:{
  attributes:{class:'journal-prose',role:'textbox','aria-label':label,'aria-multiline':'true'},
  handleKeyDown:(_view,event)=>{
   if(event.key!=='Enter'||event.shiftKey||event.isComposing||aiBusyRef.current)return false
   if(!editor)return false
   const command=activeAICommand(editor)
   if(!command?.question)return false
   event.preventDefault()
   void submitAI(editor,command)
   return true
  }
 },onUpdate:({editor})=>{changeRef.current({body:editor.getJSON(),text:editor.getText()});setAICommand(activeAICommand(editor));setAIError('')}})
 const inserted=useRef<number>(0)
 useEffect(()=>{if(!editor||!insertSnippet||insertSnippet.id===inserted.current)return;inserted.current=insertSnippet.id;editor.chain().focus().insertContent(insertSnippet.text.split('\n').filter(Boolean).map(text=>({type:'paragraph',content:[{type:'text',text}]}))).run()},[editor,insertSnippet])
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
 useEffect(()=>{const node=paper.current;if(!node)return;const observer=new ResizeObserver(()=>{const width=node.clientWidth;if(width){setPaperWidth(width);setHeight(node.clientHeight/width*1000)}});observer.observe(node);return()=>observer.disconnect()},[])
 function commit(next:InkStroke[],before=latest.current.ink){if(next===before)return;history.current.past.push(before);if(history.current.past.length>60)history.current.past.shift();history.current.future=[];changeRef.current({ink:next});refresh(n=>n+1)}
 function undo(){if(tool==='text'){editor?.chain().focus().undo().run();return}const previous=history.current.past.pop();if(previous){history.current.future.push(latest.current.ink);changeRef.current({ink:previous});setSelection([]);refresh(n=>n+1)}}
 function redo(){if(tool==='text'){editor?.chain().focus().redo().run();return}const next=history.current.future.pop();if(next){history.current.past.push(latest.current.ink);changeRef.current({ink:next});setSelection([]);refresh(n=>n+1)}}
 function point(e:ReactPointerEvent<SVGSVGElement>):InkPoint{const r=e.currentTarget.getBoundingClientRect();return {x:Math.max(0,Math.min(1000,(e.clientX-r.left)/r.width*1000)),y:Math.max(0,Math.min(height,(e.clientY-r.top)/r.height*height)),...(e.pointerType==='pen'?{pressure:Math.max(.05,e.pressure)}:{})}}
 function down(e:ReactPointerEvent<SVGSVGElement>){
  if(tool==='text'||active.current||(e.pointerType==='mouse'&&e.button!==0))return
  if(e.pointerType==='touch'&&!finger){const node=e.currentTarget.closest<HTMLElement>('.story-dialog');if(node&&!pan.current){pan.current={id:e.pointerId,y:e.clientY,top:node.scrollTop,node};e.currentTarget.setPointerCapture(e.pointerId)}return}
  pan.current=null
  e.preventDefault();e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId)
  const p=point(e),bounds=inkBounds(value.ink,selection),move=tool==='selection'&&bounds&&p.x>=bounds.x-10&&p.x<=bounds.right+10&&p.y>=bounds.y-10&&p.y<=bounds.bottom+10
  const kind=e.button===5?'eraser':move?'move':tool
  const first={...p,color,size:tool==='highlighter'?size*5:tool==='pencil'?size*.6:size,tool:tool==='highlighter'?'highlighter' as const:tool==='pencil'?'pencil' as const:'pen' as const}
  active.current={id:e.pointerId,start:p,points:[first],before:value.ink,next:value.ink,kind,selection}
  if(kind==='eraser'){active.current.next=value.ink.filter(s=>!nearStroke(s,p,18));setDrawing([])}
  else if(kind==='selection'){setSelection([]);setSelectionRect({x:p.x,y:p.y,right:p.x,bottom:p.y})}
  else if(kind!=='move')setDrawing([first])
  refresh(n=>n+1)
 }
 function move(e:ReactPointerEvent<SVGSVGElement>){
  if(pan.current?.id===e.pointerId){e.preventDefault();pan.current.node.scrollTop=pan.current.top+pan.current.y-e.clientY;return}
  const a=active.current;if(!a||a.id!==e.pointerId)return;e.preventDefault();const p=point(e)
  if(a.kind==='eraser'){a.next=a.next.filter(s=>!nearStroke(s,p,18));refresh(n=>n+1)}
  else if(a.kind==='selection')setSelectionRect({x:Math.min(a.start.x,p.x),y:Math.min(a.start.y,p.y),right:Math.max(a.start.x,p.x),bottom:Math.max(a.start.y,p.y)})
  else if(a.kind==='move'){
   const bounds=inkBounds(a.before,a.selection)!;const dx=Math.max(-bounds.x,Math.min(1000-bounds.right,p.x-a.start.x)),dy=Math.max(-bounds.y,Math.min(height-bounds.bottom,p.y-a.start.y))
   a.next=a.before.map((s,i)=>a.selection.includes(i)?s.map(q=>({...q,x:q.x+dx,y:q.y+dy})):s);refresh(n=>n+1)
  }else{a.points=[...a.points,p];setDrawing(a.points)}
 }
 function finish(cancel=false){
  pan.current=null
  const a=active.current;if(!a)return;active.current=null
  if(!cancel){if(a.kind==='selection'&&selectionRect){const r=selectionRect;setSelection(a.before.flatMap((s,i)=>s.some(p=>p.x>=r.x&&p.x<=r.right&&p.y>=r.y&&p.y<=r.bottom)?[i]:[]))}
   else if(a.kind==='eraser'||a.kind==='move'){if(JSON.stringify(a.next)!==JSON.stringify(a.before))commit(a.next,a.before)}
   else if(a.kind!=='selection')commit([...a.before,a.points],a.before)
  }
  setDrawing([]);setSelectionRect(null);refresh(n=>n+1)
 }
 async function addPhotos(files:File[]){
  if(busy)return;if(latest.current.photos.length+files.length>4){setError('사진은 한 페이지에 최대 4장까지 추가할 수 있습니다.');return}
  setBusy(true);onBusy?.(true);setError('')
  try{const added=await Promise.all(files.map(photoData));if(added.some(p=>p.length>=3000000))throw Error('사진 크기를 줄여 다시 추가하세요.');if(mounted.current)changeRef.current({photos:[...latest.current.photos,...added]})}catch(err){if(mounted.current)setError((err as Error).message)}finally{if(mounted.current){setBusy(false);onBusy?.(false)}}
 }
 const visible=active.current&&(active.current.kind==='eraser'||active.current.kind==='move')?active.current.next:value.ink
 const inkBottom=visible.reduce((bottom,s)=>s.reduce((n,p)=>Math.max(n,p.y),bottom),0)
 const bounds=inkBounds(visible,selection),rect=selectionRect||bounds
 return <section className="notebook" aria-label="노트 작성 도구">
  <div className="notebook-actions"><span>{value.text.length.toLocaleString()}자 · {value.ink.length}획</span><div>
   <Button variant="ghost" size="icon" aria-label="실행 취소" title="실행 취소" disabled={tool==='text'?!editor?.can().undo():!history.current.past.length} onClick={undo}><AppIcon name="undo"/></Button>
   <Button variant="ghost" size="icon" aria-label="다시 실행" title="다시 실행" disabled={tool==='text'?!editor?.can().redo():!history.current.future.length} onClick={redo}><AppIcon name="redo"/></Button>
   <Button variant="ghost" size="icon" aria-label="용지 설정" title="용지 설정" aria-expanded={settings} onClick={()=>setSettings(!settings)}><AppIcon name="paper"/></Button>
  </div></div>
  {settings&&<div className="notebook-settings"><label>용지<select aria-label="노트 용지" value={value.paper||'plain'} onChange={e=>onChange({paper:e.target.value as PaperStyle})}><option value="plain">무지</option><option value="ruled">줄노트</option><option value="grid">모눈</option></select></label><label className="notebook-check"><input type="checkbox" checked={finger} onChange={e=>setFinger(e.target.checked)}/>손가락 필기</label><small>펜은 필기, 손가락은 스크롤에 사용합니다.</small></div>}
  <div ref={paper} className={'notebook-paper notebook-paper-'+(value.paper||'plain')} data-tool={tool} style={{minHeight:paperWidth?Math.max(1400,inkBottom+80)*paperWidth/1000:undefined}}>
   <div className="notebook-content">{children}
    {value.photos.length>0&&<div className="journal-photo-collage" aria-label="기록 사진 모음">{value.photos.map((photo,i)=><figure key={i}><img className="journal-cover" src={photo} alt={i===0?'기록에 첨부한 사진':`기록 사진 ${i+1}`}/><Button variant="secondary" disabled={busy} aria-label={`사진 ${i+1} 삭제`} onClick={()=>onChange({photos:value.photos.filter((_,index)=>index!==i)})}>삭제</Button></figure>)}</div>}
    <EditorContent editor={editor}/>
    {aiCommand&&<div className="notebook-inline-ai" role="status" aria-label="노트 AI 명령">
     <span><b>@ AI</b> {aiCommand.question||'질문을 입력하고 Enter를 누르세요.'}</span>
     <div>
      <Button disabled={aiBusy||!aiCommand.question} onMouseDown={e=>e.preventDefault()} onClick={()=>{if(editor)void submitAI(editor,aiCommand)}}>{aiBusy?'AI 작성 중…':'노트에 작성 ↵'}</Button>
      <Button variant="ghost" disabled={aiBusy} onMouseDown={e=>e.preventDefault()} onClick={()=>{editor?.chain().focus().deleteRange({from:aiCommand.from,to:aiCommand.to}).run();setAICommand(null)}}>취소</Button>
     </div>
    </div>}
    {aiBusy&&<p className="notebook-ai-progress" role="status">AI가 노트에 넣을 초안을 작성 중입니다…</p>}
    {aiError&&<p className="notebook-ai-error" role="alert">{aiError}</p>}
   </div>
   <svg className="notebook-ink ink-canvas" viewBox={`0 0 1000 ${height}`} role="img" aria-label="손글씨 입력 영역" style={{pointerEvents:tool==='text'?'none':'auto',touchAction:'none'}} onPointerDown={down} onPointerMove={move} onPointerUp={e=>{if(!active.current||active.current.id===e.pointerId)finish()}} onPointerCancel={e=>{if(!active.current||active.current.id===e.pointerId)finish(true)}} onLostPointerCapture={e=>{if(!active.current||active.current.id===e.pointerId)finish(true)}}>
    {[...visible,drawing].map((s,i)=>s.length>0&&<path key={i} d={inkPath(s)} fill={inkColor(s[0].color)} opacity={s[0].tool==='highlighter'?.3:s[0].tool==='pencil'?.65:1}/>)}
    {rect&&<rect className="notebook-selection" x={rect.x-6} y={rect.y-6} width={rect.right-rect.x+12} height={rect.bottom-rect.y+12} fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="8 5"/>}
   </svg>
  </div>
  <div className="notebook-dock">
   {tool==='text'?<div className="journal-format" role="toolbar" aria-label="문서 서식">{[
    {label:'굵게',active:editor?.isActive('bold'),run:()=>editor?.chain().focus().toggleBold().run()},
    {label:'기울임',active:editor?.isActive('italic'),run:()=>editor?.chain().focus().toggleItalic().run()},
    {label:'밑줄',active:editor?.isActive('underline'),run:()=>editor?.chain().focus().toggleUnderline().run()},
    {label:'취소선',active:editor?.isActive('strike'),run:()=>editor?.chain().focus().toggleStrike().run()},
    {label:'소제목',active:editor?.isActive('heading',{level:2}),run:()=>editor?.chain().focus().toggleHeading({level:2}).run()},
    {label:'목록',active:editor?.isActive('bulletList'),run:()=>editor?.chain().focus().toggleBulletList().run()},
    {label:'번호 목록',active:editor?.isActive('orderedList'),run:()=>editor?.chain().focus().toggleOrderedList().run()},
    {label:'인용',active:editor?.isActive('blockquote'),run:()=>editor?.chain().focus().toggleBlockquote().run()},
    {label:'코드',active:editor?.isActive('codeBlock'),run:()=>editor?.chain().focus().toggleCodeBlock().run()},
   ].map(t=><Button key={t.label} variant="ghost" aria-pressed={!!t.active} onMouseDown={e=>e.preventDefault()} onClick={t.run}>{t.label}</Button>)}</div>:
   <div className="notebook-tool-options" aria-label="필기 도구 설정">{['pen','pencil','highlighter'].includes(tool)?<><div className="notebook-colors" role="group" aria-label="펜 색상">{inkColors.map(c=><button key={c} type="button" className="notebook-swatch" aria-label={{ink:'기본 잉크',blue:'파랑',red:'빨강',green:'초록',yellow:'노랑'}[c]} aria-pressed={color===c} style={{color:inkColor(c)}} onClick={()=>setColor(c)}><span/></button>)}</div><label>굵기<select aria-label="펜 굵기" value={size} onChange={e=>setSize(Number(e.target.value))}><option value={3}>가는 선</option><option value={5}>중간 선</option><option value={9}>굵은 선</option></select></label></>:tool==='selection'?<><span>영역을 그린 뒤 끌어 이동하세요.</span><Button variant="ghost" disabled={!selection.length} onClick={()=>{commit(value.ink.filter((_,i)=>!selection.includes(i)));setSelection([])}}>선택 삭제</Button></>:<span>획을 문질러 지웁니다. 실행 취소로 복원할 수 있습니다.</span>}</div>}
   <div className="notebook-toolbar" role="toolbar" aria-label="노트 도구">{tools.map(t=><Button key={t.id} variant="ghost" size="icon" aria-label={t.label} title={t.label} aria-pressed={tool===t.id} onClick={()=>{finish();setTool(t.id);setSelection([]);if(t.id==='highlighter')setColor('yellow');else if(t.id==='pencil')setColor('ink');if(t.id!=='text')editor?.commands.blur();else editor?.commands.focus()}}><AppIcon name={t.icon}/></Button>)}<Button variant="ghost" size="icon" aria-label="사진 추가" title="사진 추가" disabled={busy} onClick={()=>photoInput.current?.click()}><AppIcon name="photo"/></Button></div>
  </div>
  <input ref={photoInput} type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="기록 사진" disabled={busy} onChange={e=>{const files=Array.from(e.target.files||[]);e.target.value='';if(files.length)void addPhotos(files)}}/>
  {busy&&<p role="status">사진 준비 중…</p>}{error&&<p role="alert">{error}</p>}
 </section>
}
