import type {EditableRow} from '../types'
import {blankSnapshot, type JournalEntry} from './lifetimeJournal'

export type LegacyKind='thesis'|'trade'
export function legacyId(kind:LegacyKind,row:EditableRow):string{
 const key=row.id!=null?String(row.id):[row.market,row.ticker,row.date,row.no].map(x=>String(x||'')).join(':')
 return 'legacy-'+kind+'-'+key
}
export function legacyPage(kind:LegacyKind,row:EditableRow):JournalEntry{
 const date=String(row.date||'')
 const createdAt=/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date))?date+'T12:00:00.000Z':new Date(0).toISOString()
 const fields=kind==='thesis'
  ? [row.conclusion,row.thesis,row.growth_driver,row.competitive_advantage,row.moat,row.key_risk]
  : [row.thesis,row.memo,row.note,row.review_note,row.lesson,row.review_condition]
 const text=fields.filter(Boolean).map(x=>String(x)).join('\n\n')
 const ticker=[row.market,row.ticker].filter(Boolean).join(':')
 const title=String(row.name||row.ticker||'투자 기록')+(kind==='trade'?' · 투자일지':' · Thesis')
 const initial=blankSnapshot()
 return {...initial,title,kind:'investment',ticker,
  hypothesis:String(kind==='thesis'?(row.conclusion||row.thesis||''):(row.thesis||row.memo||'')),
  counterEvidence:String(row.key_risk||row.review_condition||''),
  text,body:{type:'doc',content:text.split('\n\n').filter(Boolean).map(value=>({type:'paragraph',content:[{type:'text',text:value}]}))},
  reviewDate:/^\d{4}-\d{2}-\d{2}$/.test(String(row.next_review_date||row.review_date||''))?String(row.next_review_date||row.review_date):'',
  currency:row.currency==='USD'?'USD':'KRW',
  id:legacyId(kind,row),createdAt,updatedAt:createdAt,revisions:[]}
}
export function unifiedPages(saved:JournalEntry[],theses:EditableRow[],trades:EditableRow[]):JournalEntry[]{
 const ids=new Set(saved.map(e=>e.id))
 const legacy=[...theses.filter(r=>r.ticker).map(r=>legacyPage('thesis',r)),...trades.filter(r=>r.ticker).map(r=>legacyPage('trade',r))]
 return [...saved,...legacy.filter(e=>!ids.has(e.id))]
}
