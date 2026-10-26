import type {Market} from '../types'
/** Preserve source text exactly. Only explicit signs receive market colour. */
export function ResearchText({text,market}:{text:string;market?:Market|'GLOBAL'}){
 return <>{text.split(/((?<![\p{L}\p{N}_.])[+−-]\d[\d,]*(?:\.\d+)?\s*%)/gu).map((part,i)=>i%2?<strong key={i} data-market={market} className={'research-percent '+(market&&market!=='GLOBAL'&&Number(part.replaceAll(',','').replace('−','-').replace('%','').trim())!==0?(part.startsWith('+')?'positive':'negative'):'')}>{part}</strong>:part)}</>
}
