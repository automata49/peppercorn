import {test} from 'node:test'
import assert from 'node:assert/strict'
import {buildResearchBrief,researchClass} from './instinct-research-brief.mjs'
const now=new Date('2026-10-26T12:00:00Z'),base={market:'US',asset_class:'Equity',name:'Example',ticker:'ABC',leadership_class:'핵심 주도',rs_rank:97,return_20d:.05}
test('brief fails closed for stale, missing and future snapshots',()=>{
 for(const updated_at of [null,'bad','2026-10-25T12:00:00Z','2026-10-26T14:00:00Z'])assert.deepEqual(buildResearchBrief({updated_at,rows:[base]},now).instruments,[])
})
test('brief preserves identities, return units, corrections and independent markets with a bound',()=>{
 const rows=[null,{...base,market:'KR',ticker:'000660'},...Array.from({length:30},(_,i)=>({...base,ticker:'A'+i})),{...base,asset_class:'ETF',ticker:'ETF'},{...base,stage:'조정 중',ticker:'CORR'},base,base]
 const brief=buildResearchBrief({updated_at:now.toISOString(),rows},now)
 assert.equal(brief.status,'ready');assert.equal(brief.instruments.filter(r=>r.market==='US').length,20)
 assert.equal(brief.instruments[0].market,'KR');assert.equal(brief.instruments[0].return_20d,.05)
 assert.equal(brief.return_unit,'fraction');assert(!brief.instruments.some(r=>r.ticker==='ETF'))
 assert.equal(researchClass({...base,stage:'조정 중'}),'조정 중')
})
