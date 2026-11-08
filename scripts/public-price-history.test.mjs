import {test} from 'node:test';
import assert from 'node:assert/strict';
import {historyPayload,publishPriceHistory} from './publish-price-history.mjs';
import {parseStaticHistory} from '../src/lib/priceHistory.ts';

const id='00000000-0000-4000-8000-000000000001';
const now=Date.parse('2026-11-08T08:00:00Z');
const row={id,series:[['2026-11-05',100],['2026-11-06',102.5]]};
const payload=()=>historyPayload(row,new Date(now).toISOString());

test('public export and browser parser preserve exact closes and trading dates',()=>{
  const p=payload();
  assert.equal(p.as_of,'2026-11-06');
  assert.deepEqual(parseStaticHistory(p,id,now),row.series);
  assert.equal(parseStaticHistory({...p,published_at:'2026-11-06T00:00:00Z'},id,now),null);
  assert.equal(parseStaticHistory({...p,published_at:'2026-11-09T00:00:00Z'},id,now),null);
  assert.equal(parseStaticHistory(p,'another-id',now),null);
});
test('malformed, future, unsorted and nonfinite closes fail closed',()=>{
  for(const series of [[['2026-02-31',100]],[['2026-11-09',100]],[[row.series[1][0],100],[row.series[0][0],101]],[[row.series[0][0],Infinity]],[[row.series[0][0],0]]]){
    assert.throws(()=>historyPayload({id,series},new Date(now).toISOString()));
    assert.equal(parseStaticHistory({...payload(),series:{[id]:series}},id,now),null);
  }
  assert.equal(parseStaticHistory({...payload(),as_of:'2026-11-08'},id,now),null);
  assert.throws(()=>historyPayload({...row,id:'../../private'},new Date(now).toISOString()));
});
test('a confirmed empty history stays empty and inadequate export coverage fails',async()=>{
  assert.deepEqual(parseStaticHistory(historyPayload({id,series:[]},new Date(now).toISOString()),id,now),[]);
  const db={query:async sql=>{
    assert.match(sql,/public\.price_daily/);
    assert.match(sql,/i\.asset_class in \('Equity','ETF'\)/);
    assert.doesNotMatch(sql,/journal|watchlist|holdings|research/);
    return {rows:[]};
  }};
  await assert.rejects(()=>publishPriceHistory(db),/coverage/);
});
