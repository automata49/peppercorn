// TEMP-1 시장 온도계 (by user decision 2026-10-03): Howard Marks' market temperature checklist ("The Most Important
// Thing"), translated. Every mark is the user's own judgment; app data is shown beside it as reference only and never
// sets a mark. The temperature is a plain average of the marks, not a forecast or a signal.
export const CHECKLIST_VERSION='marks-temperature-1'

export type TempItem={key:string;category:string;label:string;hot:string;cold:string}
export const TEMP_ITEMS:TempItem[]=[
  {key:'economy',category:'경기·전망',label:'경기',hot:'활발',cold:'부진'},
  {key:'outlook',category:'경기·전망',label:'전망',hot:'낙관적',cold:'비관적'},
  {key:'lenders',category:'신용·자금',label:'대출기관',hot:'적극적',cold:'소극적'},
  {key:'capital_markets',category:'신용·자금',label:'자본시장',hot:'느슨',cold:'경색'},
  {key:'capital',category:'신용·자금',label:'자본 공급',hot:'풍부',cold:'부족'},
  {key:'terms',category:'신용·자금',label:'대출 조건',hot:'관대',cold:'엄격'},
  {key:'rates',category:'신용·자금',label:'금리',hot:'낮음',cold:'높음'},
  {key:'spreads',category:'신용·자금',label:'신용 스프레드',hot:'좁음',cold:'넓음'},
  {key:'investors',category:'투자자 심리',label:'투자자',hot:'낙관·매수 열망',cold:'비관·매수 무관심'},
  {key:'owners',category:'투자자 심리',label:'자산 보유자',hot:'계속 보유',cold:'서둘러 매도'},
  {key:'sellers',category:'투자자 심리',label:'매도자',hot:'적음',cold:'많음'},
  {key:'markets',category:'투자자 심리',label:'시장',hot:'붐빔',cold:'외면'},
  {key:'funds',category:'투자자 심리',label:'펀드',hot:'가입 어렵고 신규 펀드 매일',cold:'누구나 가입, 우량 펀드만 모금'},
  {key:'managers',category:'투자자 심리',label:'운용사 협상력',hot:'운용사 우위',cold:'투자자 우위'},
  {key:'recent_returns',category:'가격·수익률',label:'최근 성과',hot:'강함',cold:'약함'},
  {key:'prices',category:'가격·수익률',label:'자산 가격',hot:'높음',cold:'낮음'},
  {key:'expected_returns',category:'가격·수익률',label:'기대 수익률',hot:'낮음',cold:'높음'},
  {key:'risk',category:'가격·수익률',label:'위험',hot:'높음',cold:'낮음'},
  {key:'qualities',category:'가격·수익률',label:'선호되는 자질',hot:'공격성·폭넓은 투자',cold:'신중·선별'},
]
export const TEMP_CATEGORIES=[...new Set(TEMP_ITEMS.map(i=>i.category))]

// A mark is 0 (hot side) .. 4 (cold side); an unmarked item is absent, never a zero.
export type TempEntry={date:string;marks:Record<string,number>;evidence:Record<string,string>;note?:string;version?:string}

const validMark=(v:unknown):v is number=>typeof v==='number'&&Number.isInteger(v)&&v>=0&&v<=4
export function markedCount(marks:Record<string,number>){return TEMP_ITEMS.filter(i=>validMark(marks[i.key])).length}
// 0° = every marked item on the cold side, 100° = every marked item on the hot side; null when nothing is marked.
export function temperature(marks:Record<string,number>):number|null{
  const values=TEMP_ITEMS.map(i=>marks[i.key]).filter(validMark)
  return values.length?Math.round(values.reduce((s,v)=>s+(4-v),0)/(values.length*4)*100):null
}
export function tempWord(t:number){return t>=80?'과열':t>=60?'다소 뜨거움':t>=40?'중립':t>=20?'다소 차가움':'냉각'}
export function tempPosture(t:number){return t>=80?'방어적으로':t>=60?'조금 방어적으로':t>=40?'균형':t>=20?'조금 공격적으로':'공격적으로'}
// Items whose mark moved against the previous entry: 'hotter' toward the hot side, 'colder' toward the cold side.
export function changes(cur:TempEntry,prev?:TempEntry|null){
  if(!prev)return []
  return TEMP_ITEMS.flatMap(i=>{const a=prev.marks[i.key],b=cur.marks[i.key];if(!validMark(a)||!validMark(b)||a===b)return [];return [{item:i,dir:b<a?'hotter' as const:'colder' as const,evidence:cur.evidence[i.key]||''}]})
}
// Entries newest first; one per date (a later save on the same date replaces it).
export function sortEntries(entries:TempEntry[]){return [...entries].filter(e=>e&&typeof e.date==='string').sort((a,b)=>b.date.localeCompare(a.date))}
export function upsertEntry(entries:TempEntry[],entry:TempEntry){return sortEntries([entry,...entries.filter(e=>e.date!==entry.date)])}
export function previousOf(entries:TempEntry[],date:string){return sortEntries(entries).find(e=>e.date<date)||null}
