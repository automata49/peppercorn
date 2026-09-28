import assert from 'node:assert/strict';
import {validatePositionAi} from './position-ai.mjs';
import {assertPositionWriteTarget} from './position-write.mjs';
import {reviewPositionMigration, positionMigrationSql} from './position-migration.mjs';

const hash='a'.repeat(64);
const source={source_id:'SEC-123',source_url:'https://www.sec.gov/Archives/test',content_hash:hash,as_of:'2026-07-26',filed_at:'2026-08-27',sections:{Results:['p-1']}};
const context={market:'US',ticker:'NVDA',task:'kpi',criteria_version:'position_v1',prompt_version:'p1',as_of:'2026-09-28',input_hash:hash,evidence:[source],missing_data:[],provider_available:true};
const output={schema_version:'1.0',criteria_version:'position_v1',prompt_version:'p1',task:'kpi',status:'ok',market:'US',ticker:'NVDA',as_of:'2026-09-28',input_hash:hash,provider:'fixture',model:'fixture',generated_at:'2026-09-28T00:00:00Z',missing_data:[],items:[{text:'Revenue from the disclosed segment',provenance:'verified',citation:{source_id:source.source_id,source_url:source.source_url,section:'Results',paragraph:'p-1',as_of:source.as_of,filed_at:source.filed_at,content_hash:hash}}]};
const clone=value=>structuredClone(value);
const cases=[
  ['matching registered citation',output,context,true],
  ['unknown paragraph',(()=>{const o=clone(output);o.items[0].citation.paragraph='p-9';return o})(),context,false],
  ['altered document hash',(()=>{const o=clone(output);o.items[0].citation.content_hash='b'.repeat(64);return o})(),context,false],
  ['verified without citation',(()=>{const o=clone(output);delete o.items[0].citation;return o})(),context,false],
  ['future citation',(()=>{const o=clone(output);o.items[0].citation.as_of='2026-10-01';return o})(),context,false],
  ['future filing',(()=>{const o=clone(output);o.items[0].citation.filed_at='2026-10-01';return o})(),context,false],
  ['mismatched input',(()=>{const o=clone(output);o.input_hash='b'.repeat(64);return o})(),context,false],
  ['wrong task',(()=>{const o=clone(output);o.task='thesis';return o})(),context,false],
  ['wrong criteria version',(()=>{const o=clone(output);o.criteria_version='position_v0';return o})(),context,false],
  ['ok reports missing data',(()=>{const o=clone(output);o.missing_data=['revenue'];return o})(),context,false],
  ['stale data',output,{...context,stale:true},false],
  ['unverified with insufficient data',(()=>{const o=clone(output);o.status='insufficient_data';o.missing_data=['missing filing'];o.items=[{text:'Needs review',provenance:'unverified'}];return o})(),{...context,missing_data:['missing filing']},true],
  ['provider unavailable',(()=>{const o=clone(output);o.status='provider_unavailable';o.items=[];return o})(),{...context,provider_available:false},true],
  ['provider unavailable cannot report ok',output,{...context,provider_available:false},false]
];
for(const [name,actual,input,expected] of cases)assert.equal(validatePositionAi(actual,input).ok,expected,name);
for(const table of ['fundamentals_q','position_snapshot','valuation_scenarios','industry_kpis','filings','ai_runs'])assert.equal(assertPositionWriteTarget(table),table);
for(const table of ['price_daily','market_metrics','stock_analyses','watchlist','portfolio_positions','user_thresholds','theses','thesis_breaks','arbitrary'])assert.throws(()=>assertPositionWriteTarget(table),/write denied/);
const migration=positionMigrationSql();
assert.deepEqual(reviewPositionMigration(migration),[],'Position migration review');
const mutations=[
  ['grant insert on a Swing table',`${migration}
grant insert on public.price_daily to position_pipeline;`],
  ['grant update on its own table',`${migration}
grant update on public.fundamentals_q to position_pipeline;`],
  ['grant read on market_metrics',`${migration}
grant select on public.market_metrics to position_pipeline;`],
  ['grant delete on instruments',`${migration}
grant delete on public.instruments to position_pipeline;`],
  ['grant write to a public role',`${migration}
grant insert on public.position_snapshot to anon;`],
  ['grant to service_role',`${migration}
grant all on public.fundamentals_q to service_role;`],
  ['create a table outside the policy',`${migration}
create table if not exists public.theses (id uuid);`],
  ['drop the RLS statement',migration.replace('alter table public.fundamentals_q enable row level security;','')],
  ['drop the Swing revoke',migration.replace(/revoke all on public\.price_daily[\s\S]*?from position_pipeline;/,'')]
];
for(const [name,sql] of mutations)assert(reviewPositionMigration(sql).length>0,`migration mutation not caught: ${name}`);
console.log(`${cases.length} Position AI evidence cases, Position write target policy and ${mutations.length} migration mutations passed (offline only).`);
