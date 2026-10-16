import {useMemo} from 'react'
import * as Popover from '@radix-ui/react-popover'
import type {EditableRow} from '../types'
const fields:[string,string,'pct'|'ratio'][]=[['sales_growth_q_auto','분기 매출 성장률','pct'],['eps_growth_q_auto','분기 EPS 성장률','pct'],['eps_growth_3y_auto','EPS 3년 CAGR','pct'],['roe_auto','ROE','pct'],['operating_margin_auto','영업이익률','pct'],['debt_ratio_auto','부채비율','pct'],['pe_auto','PER','ratio'],['peg_auto','PEG','ratio']]
export function FinancialPicker({rows,ticker,onTicker,onInsert,open,onOpenChange}:{rows:EditableRow[];ticker:string;onTicker:(v:string)=>void;onInsert:(text:string)=>void;open:boolean;onOpenChange:(next:boolean)=>void}){
 const records=useMemo(()=>rows.filter(r=>r.ticker).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))),[rows])
 const tickers=[...new Set(records.map(r=>String(r.market||'')+':'+r.ticker))]
 const match=records.find(r=>String(r.market||'')+':'+r.ticker===ticker||String(r.ticker)===ticker)
 const options=fields.flatMap(([key,label,format])=>{const value=match?.[key];if(value===null||value===undefined||value===''||!Number.isFinite(Number(value)))return [];const n=Number(value);return [{key,label,display:format==='pct'?(n*100).toFixed(1)+'%':n.toFixed(2)}]})
 return <Popover.Root open={open} onOpenChange={onOpenChange}><Popover.Trigger asChild><button type="button" className="journal-at-trigger" aria-label="Financial 정보 불러오기">@ Financial</button></Popover.Trigger><Popover.Portal><Popover.Content className="journal-mention-menu" sideOffset={8} align="start" aria-label="Financial 항목 선택">
 <header><b>@ Financial</b><Popover.Close aria-label="Financial 닫기">×</Popover.Close></header><p>저장된 Thesis의 공시 지표를 노트에 삽입합니다.</p>
 <label>종목<select aria-label="Financial 종목" value={match?String(match.market||'')+':'+match.ticker:''} onChange={e=>onTicker(e.target.value)}><option value="">종목 선택</option>{tickers.map(t=><option key={t} value={t}>{t}</option>)}</select></label>
 <div className="journal-mention-options">{options.map(({key,label,display})=><button type="button" key={key} onClick={()=>{onInsert('@Financial · '+ticker+' · '+label+': '+display+' (공시 기준 '+String(match?.filed_as_of||'미확인')+')');onOpenChange(false)}}><span>{label}</span><b>{display}</b></button>)}</div>
 {!options.length&&<p role="status">선택한 종목에 확인 가능한 공시 수치가 없습니다.</p>}
 </Popover.Content></Popover.Portal></Popover.Root>
}
