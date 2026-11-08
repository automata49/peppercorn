// Public daily closes only. Never export account, holdings, journal or research tables.
import {mkdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {connectMarketDb} from './market-db.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export function historyPayload(row,publishedAt) {
  if(!UUID.test(row.id)||!Array.isArray(row.series)||row.series.length>253)throw Error('Invalid public price history');
  let previous='';
  for(const point of row.series) {
    if(!Array.isArray(point)||point.length!==2||typeof point[0]!=='string'||
      !/^\d{4}-\d{2}-\d{2}$/.test(point[0])||!Number.isFinite(Date.parse(point[0]))||
      new Date(point[0]).toISOString().slice(0,10)!==point[0]||point[0]<=previous||
      !Number.isFinite(point[1])||point[1]<=0||point[0]>publishedAt.slice(0,10))throw Error('Invalid daily close');
    previous=point[0];
  }
  return {version:1,published_at:publishedAt,as_of:previous||null,series:{[row.id]:row.series}};
}

export async function publishPriceHistory(db,directory='dist/data/price-history') {
  const {rows}=await db.query(`select i.id,i.market,i.ticker,coalesce((
    select jsonb_agg(jsonb_build_array(p.trade_date,p.close) order by p.trade_date) from (
      select trade_date,close from public.price_daily where instrument_id=i.id
      and trade_date between current_date-420 and current_date and close>0
      order by trade_date desc limit 253
    ) p),'[]'::jsonb) as series
    from public.instruments i join public.leaderboard_view v on v.id=i.id
    where i.active and i.asset_class in ('Equity','ETF') order by i.id`);
  if(rows.length<1000||rows.filter(r=>r.series.length>=2).length/rows.length<0.90)throw Error('Public chart coverage check failed');
  for(const [market,ticker]of [['US','SPY'],['KR','226490']]) {
    if(!rows.some(r=>r.market===market&&r.ticker===ticker&&r.series.length>=2))throw Error('Public benchmark history missing');
  }
  const publishedAt=new Date().toISOString();
  const payloads=rows.map(row=>[row.id,JSON.stringify(historyPayload(row,publishedAt))]);
  mkdirSync(directory,{recursive:true});
  for(const [id,body]of payloads)writeFileSync(`${directory}/${id}.json`,body);
  console.log(`Published ${payloads.length} public daily-close files; source trading dates preserved`);
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  let db;
  try{db=await connectMarketDb();await publishPriceHistory(db);}
  catch(e){console.error(`Daily chart publication failed: ${e.message}`);process.exitCode=1;}
  finally{await db?.end();}
}
