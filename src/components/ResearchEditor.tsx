import {useId,useState} from 'react'
import type {EditableRow} from '../types'
import {EditorialHeading} from './EditorialHeading'
import {AppIcon} from './AppIcon'

type Field={id:string;label:string;kind?:'area'|'date'|'url'|'select';choices?:string[]}
const fields:Field[]=[
 {id:'date',label:'작성일',kind:'date'},
 {id:'type',label:'분류',kind:'select',choices:['매크로','산업','섹터','종목']},
 {id:'target',label:'관찰 대상'},
 {id:'title',label:'기록 제목'},
 {id:'fact',label:'확인한 사실',kind:'area'},
 {id:'interpretation',label:'나의 해석',kind:'area'},
 {id:'source',label:'원문 출처 URL',kind:'url'},
 {id:'verification',label:'확인 상태',kind:'select',choices:['미검증','확인됨','반박됨']},
 {id:'next_review_date',label:'다음 확인일',kind:'date'}
]
function ResearchForm({record,onPatch}:{record:EditableRow;onPatch:(id:string,field:string,value:string)=>string|null}){
 const [notice,setNotice]=useState('')
 const formId=useId()
 const write=(field:string,value:string)=>{
  if(field==='source'&&value.trim()){
   try{const url=new URL(value.trim());if(!['https:','http:'].includes(url.protocol))throw new Error('unsafe')}
   catch{setNotice('출처 주소는 http 또는 https URL로 입력해 주세요.');return}
  }
  if(String(record[field]??'')===value)return
  const error=onPatch(String(record.id),field,value)
  setNotice(error||'입력 내용이 기록에 반영됐습니다.')
 }
 return <form className="folio-research-form" onSubmit={event=>{event.preventDefault();const active=document.activeElement;if(active instanceof HTMLElement&&event.currentTarget.contains(active))active.blur()}}>
  <div className="folio-research-fields">
   {fields.map(field=><label key={field.id} htmlFor={formId+'-'+field.id} className={'folio-research-field'+(field.kind==='area'?' folio-research-wide':'')}>
    <span>{field.label}</span>
    {field.kind==='select'?<select id={formId+'-'+field.id} aria-label={field.label} value={String(record[field.id]||field.choices![0])} onChange={e=>write(field.id,e.target.value)}>
       {field.choices!.map(choice=><option key={choice} value={choice}>{choice}</option>)}
     </select>:field.kind==='area'?<textarea id={formId+'-'+field.id} key={String(record.id)+'|'+field.id} aria-label={field.label} rows={3} defaultValue={String(record[field.id]??'')} onBlur={e=>write(field.id,e.target.value)}/>:<input id={formId+'-'+field.id} key={String(record.id)+'|'+field.id} aria-label={field.label} type={field.kind==='date'?'date':field.kind==='url'?'url':'text'} defaultValue={String(record[field.id]??'')} onBlur={e=>write(field.id,e.target.value)}/>}
   </label>)}
  </div>
  <div className="folio-research-form-footer"><p role="status">{notice||'항목 이동 시 자동 저장됩니다. 완료 후 저장 상태를 확인하세요.'}</p><button type="submit">입력 확정</button></div>
 </form>
}
export function ResearchEditor({rows,onCreate,onPatch,onDelete}:{rows:EditableRow[];onCreate:()=>{id?:string;error?:string};onPatch:(id:string,field:string,value:string)=>string|null;onDelete:(id:string)=>string|null}){
 const [selectedId,setSelectedId]=useState<string|null>(null)
 const [notice,setNotice]=useState('')
 const selected=rows.find(r=>String(r.id)===selectedId)||rows[0]
 const create=()=>{const result=onCreate();setNotice(result.error||'');if(result.id){setSelectedId(result.id);setNotice('새 기록이 생성됐습니다. 사실과 해석을 작성해 주세요.')}}
 const remove=()=>{
  if(!selected||!window.confirm(`“${String(selected.title||selected.target||'리서치 기록')}”을 삭제할까요?`))return
  const error=onDelete(String(selected.id))
  if(error){setNotice(error);return}
  setSelectedId(null);setNotice('리서치 기록을 삭제했습니다.')
 }
 return <section className="folio-research-editor" aria-label="리서치 기록 작성">
   <div className="folio-research-topline"><EditorialHeading kicker="MY RESEARCH" title="리서치 기록" meta={rows.length+'건'} /><div className="folio-research-actions">{selected&&<button type="button" className="folio-research-remove" onClick={remove} aria-label="선택한 리서치 삭제" title="선택한 리서치 삭제"><AppIcon name="trash" size={18}/></button>}<button type="button" className="folio-research-add" onClick={create}>+ 새 기록</button></div></div>
   {notice&&<p role="status" className="folio-editor-notice">{notice}</p>}
   <div className="folio-research-layout">
    <nav className="folio-research-list" aria-label="리서치 기록 선택">
     {rows.map(r=><button type="button" key={String(r.id)} aria-pressed={String(selected?.id)===String(r.id)} onClick={()=>setSelectedId(String(r.id))}>
        <span>{String(r.date||'날짜 없음')} · {String(r.type||'관찰')}</span><strong>{String(r.title||r.target||r.ticker||'제목 없는 기록')}</strong><small>{String(r.verification||'미검증')}</small>
       </button>)}
     {!rows.length&&<p>아직 기록이 없습니다. 주제나 종목을 먼저 정하지 않아도 작성할 수 있습니다.</p>}
    </nav>
    <div className="folio-research-writing">
     {selected?<ResearchForm key={String(selected.id)} record={selected} onPatch={onPatch}/>:<p className="empty">새 기록을 만들면 사실·해석·출처를 여기에 작성할 수 있습니다.</p>}
    </div>
   </div>
 </section>
}
