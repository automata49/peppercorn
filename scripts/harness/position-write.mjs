import {readFileSync} from 'node:fs';
const policy=JSON.parse(readFileSync(new URL('../../harness/contracts/position-write-policy.json',import.meta.url),'utf8'));

/** Call before constructing a Position ingestion write; DB grants must enforce this too. */
export function assertPositionWriteTarget(table){
  if(typeof table!=='string'||!policy.writable.includes(table)||policy.protected.includes(table))throw Error(`Position pipeline write denied: ${table}`);
  return table;
}
