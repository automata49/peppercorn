/** Daily editorial excerpts. Korean lines are short, faithful paraphrases of linked primary sources, not verbatim translations. */
export type QuotePerson='buffett'|'munger'|'sagan'|'dawkins'
export type DailyQuote={person:QuotePerson;author:string;text:string;source:string;day:string}
const sources={
 buffett1996:'https://www.berkshirehathaway.com/letters/1996.html',
 buffett1992:'https://www.berkshirehathaway.com/letters/1992.html',
 buffett2011:'https://www.berkshirehathaway.com/letters/2011ltr.pdf',
 munger:'https://www.berkshirehathaway.com/letters/2022ltr.pdf',
 sagan:'https://www.pbs.org/wgbh/nova/aliens/carlsagan.html',
 saganNasa:'https://science.nasa.gov/people/vicky-hamilton/',
 dawkins:'https://www.pbs.org/faithandreason/transcript/dawk-body.html'
} as const
const people: {person:QuotePerson;author:string;lines:readonly {text:string;source:string}[]}[]=[
 {person:'buffett',author:'워런 버핏',lines:[
  {text:'십 년 못 지킬 주식은 십 분도 사지 마라.',source:sources.buffett1996},
  {text:'합리적인 가격에 좋은 사업을 사라.',source:sources.buffett1996},
  {text:'가격과 기업의 가치를 구별하라.',source:sources.buffett1996},
  {text:'위험은 변동성만으로 재지 못한다.',source:sources.buffett2011},
  {text:'성장이 늘 가치를 만드는 건 아니다.',source:sources.buffett1992},
  {text:'이해할 수 있는 기업에 투자하라.',source:sources.buffett1996}
 ]},
 {person:'munger',author:'찰리 멍거',lines:[
  {text:'인내가 투기를 이긴다.',source:sources.munger},
  {text:'세상을 있는 그대로 보라.',source:sources.munger},
  {text:'합리적으로 생각하려 애써라.',source:sources.munger},
  {text:'인내와 집중력은 배울 수 있다.',source:sources.munger},
  {text:'훌륭한 사람들의 삶에서 배워라.',source:sources.munger},
  {text:'세상이 바뀌면 판단도 바꿔라.',source:sources.munger}
 ]},
 {person:'sagan',author:'칼 세이건',lines:[
  {text:'비범한 주장엔 비범한 증거가 필요하다.',source:sources.sagan},
  {text:'어딘가에 경이로운 발견이 기다린다.',source:sources.saganNasa},
  {text:'흥분될수록 증거를 검증하라.',source:sources.sagan},
  {text:'바람보다 증거를 먼저 살펴라.',source:sources.sagan},
  {text:'우린 틀릴 수 있기에 증거를 찾는다.',source:sources.sagan},
  {text:'큰 주장에는 엄격한 검증이 따른다.',source:sources.sagan}
 ]},
 {person:'dawkins',author:'리처드 도킨스',lines:[
  {text:'복잡한 생명도 단순함에서 시작한다.',source:sources.dawkins},
  {text:'진화는 작은 변화가 쌓인 결과다.',source:sources.dawkins},
  {text:'유전자가 모든 것을 결정하진 않는다.',source:sources.dawkins},
  {text:'생물학을 알아야 한계를 넘는다.',source:sources.dawkins},
  {text:'과학에는 아직 모르는 게 많다.',source:sources.dawkins},
  {text:'복잡함도 검증 가능한 설명을 찾는다.',source:sources.dawkins}
 ]}
]
/** Stable Asia/Seoul calendar day, independent of device timezone, login, refresh or server calls. */
export function quoteDayIndex(at:Date=new Date()):number{
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(at)
 const get=(type:string)=>Number(parts.find(x=>x.type===type)?.value)
 return Math.floor(Date.UTC(get('year'),get('month')-1,get('day'))/86400000)
}
export function getDailyQuote(at:Date=new Date()):DailyQuote{
 const index=quoteDayIndex(at)-Math.floor(Date.UTC(2026,9,18)/86400000)
 const day=((index%24)+24)%24
 const item=people[day%people.length]
 const line=item.lines[Math.floor(day/people.length)]
 return {person:item.person,author:item.author,text:line.text,source:line.source,day:String(quoteDayIndex(at))}
}
