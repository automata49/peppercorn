import {useState} from 'react'
import type {ColDef} from 'ag-grid-community'
import type {EditableRow} from '../types'

/** A single edit surface for every account-scoped record list: fields down, records across. */
export function ComparisonSheet({rows,columns,onChange,label}:{rows:EditableRow[];columns:ColDef<EditableRow>[];onChange:(next:EditableRow[])=>void;label:string}){
 const [requestedPage,setRequestedPage]=useState(0)
 const size=8,total=Math.max(1,Math.ceil(rows.length/size)),page=Math.min(requestedPage,total-1)
 const fields=columns.filter(col=>typeof col.field==='string'&&!!col.headerName)
 const records=rows.slice(page*size,(page+1)*size)
 const commit=(index:number,field:string,text:string)=>{
   const original=rows[index],previous=original[field]
   const numeric=typeof previous==='number'||/^(shares|avg_price|stop_price|stop_pct|interest_price|buy_price|sell_price|importance|journal_no|analysis_no)$/.test(field)
   const nextValue=text.trim()===''?null:numeric?Number(text):text
   if(numeric&&text.trim()!==''&&!Number.isFinite(nextValue as number))return
   if(String(previous??'')===String(nextValue??''))return
   onChange(rows.map((row,i)=>i===index?{...row,[field]:nextValue}:row))
 }
 const display=(col:ColDef<EditableRow>,record:EditableRow)=>{
   const value=record[col.field!]
   if(typeof col.valueFormatter==='function'){
     try{return String(col.valueFormatter({value,data:record} as never)??'—')}catch{}
   }
   return value==null||value===''?'—':Array.isArray(value)?value.join(' · '):String(value)
 }
 if(!rows.length)return <p className="empty" role="status">비교할 기록이 없습니다. 종목 또는 기록을 추가하세요.</p>
 return <section className="vertical-compare" aria-label={label}>
   <div className="vertical-compare-viewport" role="region" aria-label={label+' · 좌우 스크롤'} tabIndex={0}>
     <table className="vertical-compare-table">
       <thead><tr><th className="vertical-compare-field" scope="col">항목</th>{records.map((record,i)=>
         <th key={String(record.id??record.market+':'+record.ticker+':'+i)} scope="col">
           {String(record.name||record.ticker||record.title||record.target||'기록 '+(page*size+i+1))}
           <small>{[record.market,record.ticker].filter(Boolean).join(' · ')||'기록 '+(page*size+i+1)}</small>
         </th>)}</tr></thead>
       <tbody>{fields.map(col=><tr key={col.field}>
         <th className="vertical-compare-field" scope="row">{col.headerName}</th>
         {records.map((record,i)=>{
           const field=col.field!,index=page*size+i,readonly=col.editable===false||field==='id'
           const raw=record[field],val=String(raw??'')
           const choices=(col.cellEditorParams as {values?:unknown[]}|undefined)?.values
           const key=String(record.id??index)+'|'+field
           return <td key={key}>{readonly?<span className="vertical-compare-readonly">{display(col,record)}</span>:
             Array.isArray(choices)?<select aria-label={col.headerName+' · '+String(record.ticker||record.title||i+1)} value={val} onChange={event=>commit(index,field,event.target.value)}>
               {!choices.some(v=>String(v)===val)&&<option value={val}>{val||'선택'}</option>}
               {choices.map(choice=><option key={String(choice)} value={String(choice)}>{String(choice)}</option>)}
             </select>: /^(note|thesis|fact|interpretation|conclusion|memo|reason|review|hypothesis)$/.test(field)?
               <textarea key={key} aria-label={col.headerName+' · '+String(record.ticker||record.title||i+1)} defaultValue={val} onBlur={event=>commit(index,field,event.target.value)} rows={2}/>:
               <input key={key} aria-label={col.headerName+' · '+String(record.ticker||record.title||i+1)} defaultValue={val} onBlur={event=>commit(index,field,event.target.value)} onKeyDown={event=>{if(event.key==='Enter')event.currentTarget.blur()}}/>
           }</td>
         })}</tr>)}</tbody>
     </table>
   </div>
   {total>1&&<nav className="vertical-compare-pages" aria-label={label+' 페이지'}>
     <button type="button" disabled={page===0} onClick={()=>setRequestedPage(Math.max(0,page-1))}>이전</button>
     <span>{page+1} / {total} · 총 {rows.length}개 기록</span>
     <button type="button" disabled={page===total-1} onClick={()=>setRequestedPage(Math.min(total-1,page+1))}>다음</button>
   </nav>}
 </section>
}
