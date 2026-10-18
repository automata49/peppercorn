/**
 * Folio's daily editorial thought. Korean translation / light paraphrase, not
 * a claim that the Korean wording is a verbatim original quotation.
 * One stable thought per Korea calendar day; zero runtime AI/network calls.
 */
export type Thinker='buffett'|'munger'|'sagan'|'dawkins'
export type DailyThought={person:Thinker;name:string;thought:string;portrait:string;credit:string;photoPage:string}
const portraits:Record<Thinker,Pick<DailyThought,'name'|'portrait'|'credit'|'photoPage'>>={
 buffett:{
  name:'워런 버핏',
  portrait:'Warren_Buffett_in_2010_(cropped).jpg',
  credit:'미국 백악관 · Public Domain',
  photoPage:'https://commons.wikimedia.org/wiki/File:Warren_Buffett_in_2010_(cropped).jpg'
 },
 munger:{
  name:'찰리 멍거',
  portrait:'Charlie_Munger.jpg',
  credit:'Nick J Webb · CC BY 2.0',
  photoPage:'https://commons.wikimedia.org/wiki/File:Charlie_Munger.jpg'
 },
 sagan:{
  name:'칼 세이건',
  portrait:'Sagan_large.jpg',
  credit:'NASA/JPL-Caltech · Public Domain',
  photoPage:'https://commons.wikimedia.org/wiki/File:Sagan_large.jpg'
 },
 dawkins:{
  name:'리처드 도킨스',
  portrait:'RichardDawkinds20090929.jpg',
  credit:'Michael Willems · CC BY 3.0',
  photoPage:'https://commons.wikimedia.org/wiki/File:RichardDawkinds20090929.jpg'
 }
}
const words:Record<Thinker,readonly string[]>={
 buffett:[
  '가격은 지불하는 것이고, 가치는 얻는 것이다.',
  '위험은 무엇을 하는지 모를 때 생긴다.',
  '훌륭한 기업을 적정한 가격에 사는 편이 낫다.',
  '시간은 훌륭한 사업의 편에 선다.'
 ],
 munger:[
  '거꾸로 생각하라. 언제나 거꾸로.',
  '매일 조금 더 현명해진 채 잠자리에 들어라.',
  '큰돈은 잦은 매매보다 기다림에서 만들어진다.',
  '자신이 아는 범위의 경계를 분명히 인식하라.'
 ],
 sagan:[
  '우리는 별의 물질로 이루어져 있다.',
  '특별한 주장에는 특별한 증거가 필요하다.',
  '과학은 지식의 집합 이상으로 생각하는 방식이다.',
  '의심과 열린 마음을 함께 지녀야 한다.'
 ],
 dawkins:[
  '우리는 유전자를 위한 생존 기계다.',
  '우리는 죽음을 맞는다는 점에서 삶의 행운아다.',
  '복잡함도 작은 변화가 축적되며 생겨날 수 있다.',
  '믿음의 크기보다 근거의 힘을 살펴야 한다.'
 ]
}
const people:readonly Thinker[]=['buffett','munger','sagan','dawkins']
/** Calendar date is resolved in Seoul even when the device is travelling. */
export function koreaDayNumber(date:Date):number{
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date)
 const field=(key:string)=>Number(parts.find(part=>part.type===key)?.value)
 return Math.floor(Date.UTC(field('year'),field('month')-1,field('day'))/86400000)
}
const launchDay=Math.floor(Date.UTC(2026,9,18)/86400000)
export function dailyThought(date=new Date()):DailyThought{
 const diff=koreaDayNumber(date)-launchDay
 const day=((diff%16)+16)%16
 const person=people[day%4]
 const turn=Math.floor(day/4)
 return {...portraits[person],person,thought:words[person][turn]}
}
export function portraitUrl(item:DailyThought):string{
 return 'https://commons.wikimedia.org/wiki/Special:FilePath/'+encodeURIComponent(item.portrait)+'?width=560'
}
