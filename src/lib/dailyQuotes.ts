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
  {text:'십 년을 보유할 수 없다면 십 분도 사지 마라.',source:sources.buffett1996},
  {text:'기업의 가치를 보고 합리적인 가격에 투자하라.',source:sources.buffett1996},
  {text:'가격의 변화와 기업 가치의 변화는 다르다.',source:sources.buffett1996},
  {text:'투자의 위험은 가격 변동만으로 재지 못한다.',source:sources.buffett2011},
  {text:'사업의 성장이 곧바로 가치 상승을 보장하진 않는다.',source:sources.buffett1992},
  {text:'이해할 수 있는 기업을 고르는 데 집중하라.',source:sources.buffett1996}
 ]},
 {person:'munger',author:'찰리 멍거',lines:[
  {text:'인내심 있는 투자자가 투기꾼을 앞선다.',source:sources.munger},
  {text:'세상을 있는 그대로 보아야 올바로 판단한다.',source:sources.munger},
  {text:'합리적으로 생각하려는 노력을 멈추지 마라.',source:sources.munger},
  {text:'긴 집중력과 인내는 배울 수 있는 강점이다.',source:sources.munger},
  {text:'존경하는 이의 삶을 읽으면 배울 것이 많다.',source:sources.munger},
  {text:'세상이 바뀌면 투자자도 계속 배워 바뀌어야 한다.',source:sources.munger}
 ]},
 {person:'sagan',author:'칼 세이건',lines:[
  {text:'비범한 주장에는 비범한 증거가 필요하다.',source:sources.sagan},
  {text:'어딘가엔 아직 발견되지 않은 경이로움이 있다.',source:sources.saganNasa},
  {text:'흥분될수록 증거를 더 엄격하게 살펴라.',source:sources.sagan},
  {text:'희망이 냉정한 검증을 앞서지 않게 하라.',source:sources.sagan},
  {text:'우리는 잘못 판단할 수 있기에 증거가 중요하다.',source:sources.sagan},
  {text:'큰 주장일수록 의심하고 검증해야 한다.',source:sources.sagan}
 ]},
 {person:'dawkins',author:'리처드 도킨스',lines:[
  {text:'생명의 복잡함은 단순한 시작에서 자라난다.',source:sources.dawkins},
  {text:'진화의 설명은 작은 단계들이 쌓인 결과다.',source:sources.dawkins},
  {text:'유전자는 운명을 완전히 결정하지 않는다.',source:sources.dawkins},
  {text:'생물학을 이해할수록 그 제약을 넘어설 수 있다.',source:sources.dawkins},
  {text:'과학에는 아직 모르는 것이 많이 남아 있다.',source:sources.dawkins},
  {text:'복잡한 현상에도 검증 가능한 설명을 찾는다.',source:sources.dawkins}
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
