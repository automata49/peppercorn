import Ajv from 'ajv';
import {readFileSync} from 'node:fs';
const schema=JSON.parse(readFileSync(new URL('../../harness/contracts/analyst.schema.json',import.meta.url),'utf8'));
const validate=new Ajv({allErrors:true,strict:false}).compile(schema);
export function validateAnalyst(output,context){
  if(!validate(output))return {ok:false,errors:validate.errors};
  const errors=[];
  const dateValid=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
  if(!dateValid(output.as_of)||output.facts.some(f=>!dateValid(f.as_of)))errors.push('invalid calendar date');
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(output.generated_at)||!Number.isFinite(Date.parse(output.generated_at))||!dateValid(output.generated_at.slice(0,10)))errors.push('invalid UTC timestamp');
  if(output.ticker!==context.ticker||output.market!==context.market||output.strategy!==context.strategy)errors.push('identity/strategy mismatch');
  for(const fact of output.facts){
    const source=context.evidence.find(e=>e.id===fact.evidence_id);
    if(!source||source.url!==fact.source_url||source.as_of!==fact.as_of)errors.push('unrecognized evidence');
    if(fact.as_of>output.as_of)errors.push('future evidence');
  }
  if(output.as_of!==context.as_of)errors.push('as-of mismatch');
  if((context.stale||context.missing_data.length)&&output.status==='ok')errors.push('incomplete/stale input cannot be ok');
  if(context.provider_available===false&&output.status!=='provider_unavailable')errors.push('provider is unavailable');
  return {ok:errors.length===0,errors};
}
