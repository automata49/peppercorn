import Ajv from 'ajv';
import {readFileSync} from 'node:fs';

const schema=JSON.parse(readFileSync(new URL('../../harness/contracts/position-ai.schema.json',import.meta.url),'utf8'));
const validate=new Ajv({allErrors:true,strict:false}).compile(schema);
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
const validTimestamp=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value)&&!Number.isNaN(Date.parse(value))&&validDate(value.slice(0,10));

/** Call before persisting any AI-extracted Position Growth claims. */
export function validatePositionAi(output,context){
  if(!validate(output))return {ok:false,errors:validate.errors.map(error=>`${error.instancePath} ${error.message}`)};
  const errors=[];
  if(!validDate(output.as_of)||!validTimestamp(output.generated_at))errors.push('invalid as-of date or UTC timestamp');
  if(output.market!==context.market||output.ticker!==context.ticker||output.as_of!==context.as_of||output.input_hash!==context.input_hash||output.task!==context.task||output.criteria_version!==context.criteria_version||output.prompt_version!==context.prompt_version)errors.push('input identity/version mismatch');
  if(context.provider_available===false&&output.status!=='provider_unavailable')errors.push('provider unavailable');
  if((context.stale||context.missing_data?.length)&&output.status==='ok')errors.push('stale or missing input');
  if(output.status==='ok'&&!output.items.some(item=>item.provenance==='verified'))errors.push('ok requires verified evidence');
  if(output.status==='ok'&&output.missing_data.length)errors.push('ok cannot report missing data');
  if(output.status==='insufficient_data'&&!output.missing_data.length)errors.push('missing data explanation required');
  for(const item of output.items){
    const c=item.citation;
    if(!c)continue;
    const source=context.evidence?.find(e=>e.source_id===c.source_id);
    if(!source||source.source_url!==c.source_url||source.content_hash!==c.content_hash||source.as_of!==c.as_of||source.filed_at!==c.filed_at||!source.sections?.[c.section]?.includes(c.paragraph))errors.push('citation does not match registered source location');
    if(!validDate(c.as_of)||!validDate(c.filed_at)||c.as_of>output.as_of||c.filed_at>output.as_of)errors.push('invalid or future citation date');
  }
  return {ok:errors.length===0,errors};
}

if(process.argv[1]&&import.meta.url===new URL(`file://${process.argv[1]}`).href){
  const [, ,outputPath,contextPath]=process.argv;
  if(!outputPath||!contextPath){console.error('usage: node scripts/harness/position-ai.mjs output.json context.json');process.exit(2)}
  const result=validatePositionAi(JSON.parse(readFileSync(outputPath,'utf8')),JSON.parse(readFileSync(contextPath,'utf8')));
  if(!result.ok){console.error(result.errors.join('\n'));process.exit(1)}
  console.log('Position AI citations validated against registered evidence.');
}
