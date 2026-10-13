export function instrumentLabel(row:{market?:unknown;ticker?:unknown;name?:unknown}){
 return String(row.market==='US'?(row.ticker||row.name):(row.name||row.ticker)||'')
}
