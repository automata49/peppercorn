import { useEffect, useState } from 'react'
import type { EditableRow } from '../types'
import { Button } from './ui/button'
const fields = { thesis: '매수 이유(가설)', review_condition: '재검토 조건', review_date: '재검토일', review_note: '결과 복기', lesson: '교훈' } as const
export function LinkedTradeOriginal({row,onClose,onSave,initialDraft,onDraft}:{row:EditableRow;onClose:()=>void;onSave:(fields:EditableRow)=>Promise<void>;initialDraft?:EditableRow;onDraft:(fields:EditableRow|undefined)=>void}){
 const [draft,setDraft]=useState<EditableRow>(()=>initialDraft||Object.fromEntries(Object.keys(fields).map(key=>[key,row[key]||''])))
 const [busy,setBusy]=useState(false),[dirty,setDirty]=useState(!!initialDraft),[notice,setNotice]=useState('')
 useEffect(()=>{if(!dirty)return;const handler=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue=''};addEventListener('beforeunload',handler);return()=>removeEventListener('beforeunload',handler)},[dirty])
 return <section className="linked-trade-original" aria-label="선택한 투자일지 원본" data-record-id={String(row.id)}><header><h2>{String(row.name||row.ticker)} · {String(row.date||'')}</h2><Button variant="ghost" disabled={busy} onClick={()=>{if(!dirty||confirm('저장하지 않은 변경이 있습니다. 닫을까요?')){onDraft(undefined);onClose()}}}>원본 기록 닫기</Button></header>{Object.entries(fields).map(([field,label])=><label key={field}>{label}<textarea aria-label={field+' 원본'} value={String(draft[field]||'')} onChange={e=>{const next={...draft,[field]:e.target.value};setDraft(next);onDraft(next);setDirty(true);setNotice('')}} disabled={busy}/></label>)}<Button disabled={busy||!dirty} onClick={async()=>{setBusy(true);try{await onSave(draft);onDraft(undefined);setDirty(false);setNotice('원본 변경을 저장했습니다.')}catch(e){setNotice((e as Error).message)}finally{setBusy(false)}}}>{busy?'저장 중…':'원본 변경 저장'}</Button><p className="note">입력은 임시 보관하고, 변경 저장 시 이 원본 기록에 반영합니다.</p>{notice&&<p role="status">{notice}</p>}</section>
}
