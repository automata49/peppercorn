// Scheduled daily-bar collection without the quota-restricted HTTP/Edge API.
import {mkdirSync, writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {metrics, symbol} from '../supabase/functions/_shared/market-metrics.ts';
import {connectMarketDb, publicSnapshot} from './market-db.mjs';

export function completedRows(result, lastSession) {
  const quote=result?.indicators?.quote?.[0];
  if (!quote || !result.timestamp?.length) throw Error('no_daily_bars');
  return result.timestamp.map((t,i)=>({date:new Date(t*1000).toISOString().slice(0,10),
    open:quote.open?.[i]??null, high:quote.high?.[i]??null, low:quote.low?.[i]??null,
    close:quote.close?.[i]??null, volume:quote.volume?.[i]??null}))
    .filter(r=>r.date<=lastSession && Number.isFinite(r.close) && r.close>0)
    .sort((a,b)=>a.date.localeCompare(b.date));
}

export function checkCoverage(instruments, successes, dates) {
  for (const market of Object.keys(dates)) {
    const selected=instruments.filter(i=>i.market===market);
    const fresh=successes.filter(s=>s.instrument.market===market && s.metric.as_of===dates[market]);
    const benchmark=market==='US'?'SPY':'226490';
    if (!selected.length || fresh.length/selected.length<0.90 || !fresh.some(s=>s.instrument.ticker===benchmark)) {
      throw Error(`${market} fresh coverage failed (${fresh.length}/${selected.length}, expected ${dates[market]}, benchmark ${benchmark})`);
    }
  }
}

async function fetchInstrument(instrument, lastSession) {
  const ticker=symbol(instrument);
  let failure;
  for(let attempt=0;attempt<3;attempt++) {
    try {
      const url=new URL('https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(ticker));
      url.search=new URLSearchParams({range:'18mo',interval:'1d',events:'history'});
      const response=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 PeppercornCapital/1.0'},signal:AbortSignal.timeout(25000)});
      if(!response.ok)throw Error('provider_http_'+response.status);
      const payload=await response.json();
      const prices=completedRows(payload?.chart?.result?.[0],lastSession);
      const metric=metrics(prices);
      if (!metric || metric.as_of!==lastSession) throw Error('stale_or_insufficient_daily_bars');
      return {instrument,prices,metric};
    } catch(e) {failure=e; if(attempt<2)await new Promise(r=>setTimeout(r,1000*(attempt+1)));}
  }
  throw failure;
}

async function saveInstrument(db, {instrument,prices,metric}) {
  // Bound writes to the missing tail. Existing historical bars remain intact.
  const cutoff=instrument.last_date ? new Date(new Date(instrument.last_date).getTime()-7*86400000).toISOString().slice(0,10) : '0000-01-01';
  const tail=prices.filter(p=>p.date>=cutoff);
  await db.query(`insert into public.price_daily(instrument_id,trade_date,open,high,low,close,volume)
    select $1::uuid,x.date,x.open,x.high,x.low,x.close,x.volume from jsonb_to_recordset($2::jsonb)
    as x(date date,open numeric,high numeric,low numeric,close numeric,volume bigint)
    on conflict(instrument_id,trade_date) do update set open=excluded.open,high=excluded.high,low=excluded.low,close=excluded.close,volume=excluded.volume`,
    [instrument.id,JSON.stringify(tail)]);
  const columns=Object.keys(metric);
  const values=columns.map(k=>metric[k]);
  // Column identifiers originate only in the shared metric function, never provider content.
  if(columns.some(k=>!/^[a-z][a-z0-9_]*$/.test(k)))throw Error('invalid_metric_column');
  await db.query(`insert into public.market_metrics(instrument_id,${columns.join(',')}) values($1,${values.map((_,i)=>'$'+(i+2)).join(',')})
    on conflict(instrument_id,as_of) do update set ${columns.filter(c=>c!=='as_of').map(c=>`${c}=excluded.${c}`).join(',')},updated_at=now()`,[instrument.id,...values]);
}

export async function main() {
  const dates=JSON.parse(process.env.CLOSED_SESSIONS||'{}');
  if(!Object.keys(dates).length || Object.entries(dates).some(([k,v])=>!['KR','US'].includes(k)||!/^\d{4}-\d{2}-\d{2}$/.test(v)))throw Error('Validated CLOSED_SESSIONS are required');
  const db=await connectMarketDb();
  try {
    const {rows:instruments}=await db.query(`select i.id,i.market,i.ticker,i.exchange,
      (select max(trade_date)::text from public.price_daily p where p.instrument_id=i.id) as last_date
      from public.instruments i where i.active=true and i.market=any($1::text[]) order by i.market,i.ticker`,[Object.keys(dates)]);
    const successes=[],failures=[];
    for(let offset=0;offset<instruments.length;offset+=8) {
      await Promise.all(instruments.slice(offset,offset+8).map(async instrument=>{
        try{successes.push(await fetchInstrument(instrument,dates[instrument.market]));}
        catch{failures.push({market:instrument.market,ticker:instrument.ticker});}
      }));
      if(offset%80===0)console.log(`Collected ${Math.min(offset+8,instruments.length)}/${instruments.length}; fresh=${successes.length}; failed=${failures.length}`);
    }
    checkCoverage(instruments,successes,dates);
    // No partial new ranking is visible: prices, metrics and existing calculations commit together.
    await db.query('begin');
    await db.query("select pg_advisory_xact_lock(hashtext('folio-market-refresh'))");
    try {
      for(const success of successes)await saveInstrument(db,success);
      await db.query('select public.recalculate_market_leadership()');
      await db.query('select public.recalculate_etf_relative_strength()');
      await db.query('commit');
    } catch(e) {await db.query('rollback');throw e;}
    const snapshot=await publicSnapshot(db);
    mkdirSync('market-output',{recursive:true});
    writeFileSync('market-output/leaderboard.json',JSON.stringify(snapshot));
    writeFileSync('market-output/refresh-status.json',JSON.stringify({completed_at:snapshot.published_at,expected_sessions:dates,
      requested:instruments.length,fresh:successes.length,failed:failures.length,failed_instruments:failures}));
    console.log(JSON.stringify({expected_sessions:dates,requested:instruments.length,fresh:successes.length,failed:failures.length,exported:snapshot.rows.length}));
  } finally {await db.end();}
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(e.message);process.exitCode=1;});
