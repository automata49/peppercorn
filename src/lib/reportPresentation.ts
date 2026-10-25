import type {ReportTable,SourceReport} from './sourceReports'

export function splitReportShelf(items:SourceReport[]){
 const sorted=[...items].sort((a,b)=>Date.parse(b.source_modified_at)-Date.parse(a.source_modified_at)||a.drive_file_id.localeCompare(b.drive_file_id))
 return {latest:sorted[0],history:sorted.slice(1)}
}
export function reportSummary(line:string){
 const match=/^\[(시장|산업|종목)\]\s*([\s\S]*)$/.exec(line)
 return {label:match?.[1]||'요약',text:match?.[2]||line}
}
export type ReportBlock={kind:'text'|'facts'|'outlook'|'note';text:string}
export function reportBlocks(value:string):ReportBlock[]{
 const markers:Record<string,ReportBlock['kind']>={'확인된 사실':'facts','사실':'facts','전망 · 미확정':'outlook','자료 유의사항':'note'}
 const blocks:ReportBlock[]=[];let kind:ReportBlock['kind']='text',lines:string[]=[]
 const flush=()=>{const text=lines.join('\n').trim();if(text)blocks.push({kind,text});lines=[]}
 for(const line of value.split('\n')){
  const marker=markers[line.trim()]
  if(marker){flush();kind=marker}else lines.push(line)
 }
 flush();return blocks
}
/** Only explicit comparable table values: no number extraction from prose or unit conversion. */
export function reportChart(table:ReportTable){
 if(table.columns.length!==2||table.rows.length<2||table.rows.length>20)return null
 const context=table.caption+' '+table.columns[1]
 if(/(?:미확인|unknown|서로 다른 단위)/i.test(context))return null
 const unit=/^(?:(?:USD|KRW)\s+(?:million|billion)|백만\s*달러|억\s*달러|조원|억원|만원|달러|USD|KRW|GWh|MWh|GW|MW|톤|대|개|원|%)$/i
 // Require an actual unit declaration, not a substring such as 원문/개요/대상.
 const declarations=[table.columns[1],...table.caption.split(/[·|]/),...Array.from(context.matchAll(/[（(]([^）)]+)[）)]/g),m=>m[1])]
 const units=new Set(declarations.map(s=>s.trim().replace(/^단위\s*[:：]\s*/,''))
  .filter(s=>unit.test(s)).map(s=>s.toLowerCase().replace(/\s+/g,' ')))
 if(units.size!==1)return null
 // A second unit in prose or a row label makes comparison ambiguous too.
 const mentioned=new Set(Array.from((context+' '+table.rows.map(r=>r[0]).join(' ')).matchAll(/(?:^|[\s·(（:：])((?:USD|KRW)\s+(?:million|billion)|백만\s*달러|억\s*달러|조원|억원|만원|달러|USD|KRW|GWh|MWh|GW|MW|톤|대|개|원|%)(?=$|[\s·)）,，;])/gi),m=>m[1].toLowerCase().replace(/\s+/g,' ')))
 if(mentioned.size>1)return null
 const rows=table.rows.map(row=>{
  const raw=row[1]?.trim()
  if(!row[0]?.trim()||!raw||raw.length>40||!/^\+?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(raw))return null
  const value=Number(raw.replaceAll(',',''))
  return Number.isFinite(value)&&value<=Number.MAX_SAFE_INTEGER?{label:row[0],display:row[1],value}:null
 })
 if(rows.some(r=>!r)||new Set(rows.map(r=>r?.label)).size!==rows.length)return null
 const values=rows.filter((r):r is NonNullable<typeof r>=>!!r),max=Math.max(...values.map(r=>r.value))
 return max>0?{rows:values,max}:null
}
