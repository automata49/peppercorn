import type {EditableRow} from '../types'
import {blankSnapshot,type JournalEntry} from './lifetimeJournal'
// Source rows remain intact. Their stable virtual IDs materialize in notebook storage when edited or reviewed.
export function legacyJournalEntry(kind:'thesis'|'trade',row:EditableRow,index:number):JournalEntry {
 const market=String(row.market||'').toUpperCase(),ticker=String(row.ticker||'').trim(),date=String(row.date||'')
 const createdAt=/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date))?date+'T12:00:00.000Z':'1970-01-01T00:00:00.000Z'
 const identity=String(row.id??[market,ticker,date,index].join('-')),id='workspace-'+kind+'-'+encodeURIComponent(market+'|'+identity)
 const label=market==='US'?ticker:String(row.name||ticker)
 const pairs=kind==='thesis'?[['결론',row.conclusion],['경쟁우위',row.moat],['성장 동력',row.growth_driver],['핵심 리스크',row.key_risk],['분석일',date]]:[['매수가',row.buy_price],['목표가',row.target_price],['손절가',row.stop_price],['기존 투자 가설',row.thesis],['검토 조건',row.review_condition],['매매 결과',row.review_note],['배운 점',row.lesson],['기록일',date]]
 const text=pairs.filter(([,value])=>value!==null&&value!==undefined&&String(value).trim()).map(([key,value])=>key+' · '+value).join('\n')
 const hypothesis=String(kind==='thesis'?(row.conclusion||row.growth_driver||''):(row.thesis||row.memo||''))
 return {...blankSnapshot(),id,title:label+' · '+(kind==='thesis'?'Thesis':'투자일지'),kind:'investment',ticker:market&&ticker?market+':'+ticker:ticker,hypothesis,counterEvidence:String(kind==='thesis'?(row.key_risk||''):(row.review_condition||'')),text,body:{type:'doc',content:text.split('\n').filter(Boolean).map(line=>({type:'paragraph',content:[{type:'text',text:line}]}))},reviewDate:String((kind==='thesis'?row.next_review_date:row.review_date)||'').match(/^\d{4}-\d{2}-\d{2}$/)?.[0]||'',createdAt,updatedAt:createdAt,revisions:[]}
}
export function mergeLegacyJournal(entries:JournalEntry[],theses:EditableRow[],trades:EditableRow[]):JournalEntry[]{
 const known=new Set(entries.map(e=>e.id))
 const virtual=[...theses.filter(r=>!!r.ticker&&[r.conclusion,r.moat,r.growth_driver,r.key_risk].some(v=>typeof v==='string'&&v.trim())).map((row,i)=>legacyJournalEntry('thesis',row,i)),...trades.filter(r=>!!r.ticker).map((row,i)=>legacyJournalEntry('trade',row,i))]
 return [...entries,...virtual.filter(e=>!known.has(e.id))]
}
