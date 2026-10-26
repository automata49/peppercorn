import {readFileSync,writeFileSync,existsSync} from 'node:fs'
import {pathToFileURL} from 'node:url'
const classes=['핵심 주도','주도 후보','강세 전환','조정 중']
const finite=value=>typeof value==='number'&&Number.isFinite(value)?value:null
// Same existing equity display classification; this never writes ranks or market data.
export function researchClass(row){
 if(row.asset_class!=='Equity')return null
 if(String(row.stage||'').includes('조정 중'))return '조정 중'
 if(row.leadership_class)return classes.includes(row.leadership_class)?row.leadership_class:null
 if(row.leader_tt&&(row.rs_rank??0)>=95&&(row.high_52w_distance??-1)>=-.15&&(row.rs_3m??-1)>0&&(row.rs_6m??-1)>0)return classes[0]
 if(row.leader_tt&&(row.ibd_rs_estimate??0)>=80&&(row.high_52w_distance??-1)>=-.25&&(row.rs_3m??-1)>0)return classes[1]
 return String(row.stage).includes('넥스트 리더')?classes[2]:null
}
export function buildResearchBrief(payload,now=new Date()){
 const asOf=payload?.updated_at,age=now.getTime()-Date.parse(asOf)
 const valid=Number.isFinite(age)&&age>=-3600000&&age<=20*3600000
 const seen=new Set(),selected=[]
 if(valid)for(const market of ['KR','US']){
  const rows=(Array.isArray(payload?.rows)?payload.rows:[]).filter(row=>row&&row.market===market&&researchClass(row)&&typeof row.name==='string'&&new RegExp(market==='KR'?'^\\d{6}$':'^[A-Z][A-Z0-9.-]{0,11}$').test(row.ticker))
  rows.sort((a,b)=>classes.indexOf(researchClass(a))-classes.indexOf(researchClass(b))||(finite(b.rs_rank)??-1)-(finite(a.rs_rank)??-1)||a.ticker.localeCompare(b.ticker))
  for(const row of rows){
   const key=market+':'+row.ticker;if(seen.has(key))continue;seen.add(key)
   selected.push({market,ticker:row.ticker,name:row.name,leadership_class:researchClass(row),sector:row.sector||null,industry:row.industry||null,rs_rank:finite(row.rs_rank),return_20d:finite(row.return_20d),return_50d:finite(row.return_50d)})
   if(selected.filter(r=>r.market===market).length===20)break
  }
 }
 return {version:1,type:'folio-research-brief',generated_at:now.toISOString(),snapshot_at:valid?asOf:null,status:!valid?'unavailable':selected.length?'ready':'empty',source:'https://automata49.github.io/peppercorn/data/leaderboard.json',return_unit:'fraction',selection:'Existing equity leadership classes, class then RS order, at most 20 per market; no ETF equity classification.',instruments:selected,instructions:[
  '매 실행마다 이 파일을 다시 읽고 status=ready, snapshot_at가 20시간 이내인지 확인. unavailable/empty이면 주도 종목을 추정하거나 이전 목록으로 작성하지 말 것.',
  'instruments의 market+ticker를 기준으로 주도 종목과 연결된 시장·산업·실적·수주·공급망·정책 뉴스를 다양한 원문 출처에서 조사. 고정 회사 채널만 반복하지 말 것.',
  '핵심 주도/주도 후보를 우선하고 강세 전환/조정 중은 반증·위험을 확인. 분류와 RS는 Folio 데이터이며 매수 추천이 아님.',
  '각 종목 사실·수치·기간·단위·원문 날짜와 URL, 전망·미확정, 다음 확인 조건을 구분. 해당 뉴스가 없으면 없다고 기록하고 만들지 말 것.',
  '뉴스는 공개 사실 요약만 Folio-News-YYYY-MM-DD.json v1 items에 저장. 리포트는 비공개 Folio-Report-YYYY-MM-DD.json에 tickers와 [시장]/[산업]/[종목] 요약 및 sections에 저장.',
  '리포트 tables는 원문 수치·단위·기간을 유지. images는 검증 가능한 출처와 이용 조건을 포함한 7필드, 최대 3개/항목. 없는 데이터나 권한을 추정하지 말 것.',
  'return_20d/return_50d는 fraction(0.05=5%)이며 기사 당시 일간 등락률로 쓰지 말 것. snapshot_at는 스냅샷 조회 시각이며 거래일/시세 기준일이 아님. 원문 발행 시각과 구분하고 시세 기준일을 추정하지 말 것.'
 ],content_contract:'https://github.com/automata49/peppercorn/blob/main/docs/INSTINCT_CONTENT_CONTRACT.md'}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const path='dist/data/leaderboard.json'
 const payload=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):null
 const brief=buildResearchBrief(payload)
 writeFileSync('dist/data/instinct-research-brief.json',JSON.stringify(brief,null,2)+'\n')
 console.log(`Instinct research brief: ${brief.status}, ${brief.instruments.length} public instruments`)
}
