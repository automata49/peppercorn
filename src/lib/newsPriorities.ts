import {diverseInstinctNews,type InstinctArticle} from './instinctLeaderNews'
import type {ReportDetail,SourceReport} from './sourceReports'

export type NewsGroup='trend'|'industry'|'stock'
export type NewsContext={latest?:SourceReport;detail?:ReportDetail;uid:string}
const themes=[
 /반도체|메모리|파운드리|\b(?:semiconductor|chips?|hbm|dram|nand|foundry)\b/i,
 /인공지능|데이터\s*센터|클라우드|\b(?:ai|artificial intelligence|data ?centers?|cloud|gpu)\b/i,
 /배터리|전기차|이차전지|\b(?:battery|batteries|electric vehicles?|ev)\b/i,
 /전력|에너지|원유|천연가스|재생|\b(?:energy|oil|gas|power grid|renewable|solar)\b/i,
 /로봇|자동화|\b(?:robotics?|automation)\b/i,
 /우주|위성|항공|\b(?:space|satellite|aerospace)\b/i,
 /바이오|제약|의료|\b(?:biotech|pharma|healthcare|clinical)\b/i,
 /방산|국방|\b(?:defense|defence|military)\b/i,
 /금융|은행|\b(?:banking|banks?|financials?)\b/i,
 /금리|연준|통화정책|\b(?:interest rates?|federal reserve|inflation)\b/i,
 /관세|무역|지정학|\b(?:tariffs?|trade|geopolitic\w*)\b/i,
]
const macro=/거시|매크로|자금흐름|규제|코스피|코스닥|시황|시장|증시|지수|정치|선거|전쟁|고용|정책|금리|연준|물가|관세|무역|지정학|외교|경제|환율|\b(?:macro|market|election|politics|employment|policy|rates?|inflation|tariffs?|trade|geopolitic\w*|economy)\b/i
export function newsGroup(item:InstinctArticle):NewsGroup{
 if(item.type!=='trend')return 'stock'
 if(macro.test(item.trend_topic))return 'trend'
 return themes.slice(0,9).some(t=>t.test(item.trend_topic))||/산업|공급망|인프라|미디어|헬스케어|신제품|빅테크|소프트웨어|자동차|물류|운송|\b(?:industry|supply chain|infrastructure)\b/i.test(item.trend_topic)?'industry':'trend'
}
const canonical=(value:string)=>{try{const u=new URL(value);u.hash='';return u.href}catch{return value}}
/** Account-owned report evidence affects display order only; never persist private signals. */
export function prioritizeNews(items:InstinctArticle[],context:NewsContext,now=Date.now()){
 const {latest,detail}=context.uid?context:{latest:undefined,detail:undefined}
 const reportText=latest?[latest.title,...latest.summary,...(detail?.pages.flatMap(p=>[p.heading||'',p.text])||[])].join('\n'):''
 const reportThemes=themes.filter(t=>t.test(reportText))
 const tickers=new Set(detail?.pages.flatMap(p=>(p.tickers||[]).map(t=>t.market+':'+t.ticker))||[])
 const citations=new Set(detail?.links.map(l=>canonical(l.url))||[])
 const groups:Record<NewsGroup,{item:InstinctArticle;reason:string;score:number}[]>={trend:[],industry:[],stock:[]}
 for(const item of diverseInstinctNews(items,now)){
  const cited=!!latest&&citations.has(canonical(item.source_url))
  const mentioned=!!latest&&item.type!=='trend'&&tickers.has(item.market+':'+item.ticker)
  const linked=!!latest&&reportThemes.some(t=>t.test([item.type==='trend'?item.trend_topic:'',item.headline,item.summary].join(' ')))
  groups[newsGroup(item)].push({item,reason:cited?'리포트 출처':mentioned?'리포트 언급 종목':linked?'리포트 관련 분야':'',score:cited?3:mentioned?2:linked?1:0})
 }
 for(const list of Object.values(groups))list.sort((a,b)=>b.score-a.score||Date.parse(b.item.published_at)-Date.parse(a.item.published_at))
 return groups
}
