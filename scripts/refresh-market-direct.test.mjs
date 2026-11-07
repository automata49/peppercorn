import {test} from 'node:test';
import assert from 'node:assert/strict';
import {completedRows,checkCoverage} from './refresh-market-direct.mjs';
import {metrics,symbol} from '../supabase/functions/_shared/market-metrics.ts';

test('shared metrics preserve daily return units, lookbacks and Wilder RSI',()=>{
  const rows=Array.from({length:300},(_,i)=>({date:'2026-11-06',close:100+i,high:101+i,low:99+i,volume:1000}));
  const m=metrics(rows);
  assert.equal(m.return_20d,399/379-1);
  assert.equal(m.return_200d,399/199-1);
  assert.equal(m.ma50,374.5);
  assert.equal(m.ma200,299.5);
  assert.equal(m.rsi14,100);
  assert.equal(m.volume_ratio,1);
  assert.equal(metrics(rows.slice(0,21)),null);
  assert.equal(symbol({ticker:'BFB',market:'US'}),'BF-B');
  assert.equal(symbol({ticker:'123456',market:'KR',exchange:'KOSDAQ'}),'123456.KQ');
});
test('incomplete, future and invalid daily bars never become the latest close',()=>{
  const result={timestamp:['2026-11-05','2026-11-06','2026-11-09'].map(d=>Date.parse(d)/1000),
    indicators:{quote:[{close:[1,2,3],high:[1,2,3],low:[1,2,3],volume:[10,20,30]}]}};
  assert.deepEqual(completedRows(result,'2026-11-06').map(r=>r.close),[1,2]);
  result.indicators.quote[0].close[1]=NaN;
  assert.equal(completedRows(result,'2026-11-06').length,1);
});
test('coverage rejects provider-wide failures, stale data and missing benchmarks',()=>{
  const instruments=Array.from({length:10},(_,i)=>({market:'US',ticker:i?'T'+i:'SPY'}));
  const successes=instruments.map(instrument=>({instrument,metric:{as_of:'2026-11-06'}}));
  const dates={US:'2026-11-06'};
  assert.doesNotThrow(()=>checkCoverage(instruments,successes,dates));
  assert.throws(()=>checkCoverage(instruments,successes.slice(0,8),dates));
  assert.throws(()=>checkCoverage(instruments,successes.slice(1),dates));
  assert.throws(()=>checkCoverage(instruments,successes,{US:'2026-11-09'}));
});
