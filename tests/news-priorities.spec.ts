import {test,expect} from '@playwright/test'
import {prioritizeNews,newsGroup} from '../src/lib/newsPriorities'
import type {InstinctArticle} from '../src/lib/instinctLeaderNews'
import type {ReportDetail,SourceReport} from '../src/lib/sourceReports'
const now=Date.parse('2026-11-08T09:00:00Z')
const stock=(ticker:string,hours:number,headline='공개 발표에서 확인된 기업 뉴스'):InstinctArticle=>({market:'US',ticker,headline,summary:'공개 자료에서 확인한 원문 내용을 전달합니다.',source_name:'Reuters',source_url:'https://reuters.com/'+ticker,published_at:new Date(now-hours*3600000).toISOString()})
const latest={title:'반도체 일일분석',summary:['[산업] 반도체 설비 투자 동향'],content_hash:'a'} as SourceReport
const detail={pages:[{text:'반도체 시장',number:1,images:[]},{text:'추가 종목',number:2,images:[],tickers:[{market:'US',ticker:'AMD'}]}],links:[{label:'원문',url:'https://reuters.com/IBM#evidence'}]} as ReportDetail

test('report citations, exact tickers from all pages and report sectors outrank recent unrelated news',()=>{
 const items=[stock('AAPL',1),stock('NVDA',2,'반도체 생산 설비 투자 발표'),stock('AMD',20),stock('IBM',40)]
 const groups=prioritizeNews(items,{uid:'owner',latest,detail},now)
 expect(groups.stock.map(x=>x.item.type!=='trend'&&x.item.ticker)).toEqual(['IBM','AMD','NVDA','AAPL'])
 expect(groups.stock.map(x=>x.reason)).toEqual(['리포트 출처','리포트 언급 종목','리포트 관련 분야',''])
 expect(items[0].ticker).toBe('AAPL')
 const guest=prioritizeNews(items,{uid:'',latest,detail},now)
 expect(guest.stock.map(x=>x.reason)).toEqual(['','','',''])
 expect(guest.stock[0].item).toBe(items[0])
})
test('explicit trend topics separate macro trends from industry; ticker and English word boundaries stay exact',()=>{
 const trend={...stock('AAPL',1),type:'trend' as const,market:'GLOBAL' as const,trend_topic:'시황·지정학'}
 expect(newsGroup(trend)).toBe('trend')
 expect(newsGroup({...trend,trend_topic:'로봇·반도체'})).toBe('industry')
 expect(newsGroup(stock('AAPL',1))).toBe('stock')
 const ai={...latest,title:'AI',summary:[]} as SourceReport
 const result=prioritizeNews([stock('AMDQ',1,'Company said revenue grew'),stock('AMD',2)],{uid:'owner',latest:ai,detail:{...detail,links:[]}},now)
 expect(result.stock.map(x=>x.reason)).toEqual(['리포트 언급 종목',''])
 const switched=prioritizeNews([stock('AMD',2)],{uid:'another',latest:{...latest,title:'우주',summary:[]}},now)
 expect(switched.stock[0].reason).toBe('')
})
