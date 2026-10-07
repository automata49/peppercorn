// Display-only market semantics; no classification or ranking calculation.
export const HEAT_MISSING={bg:'#e4e7eb',ink:'#5d6b7c'}
export function heatColor(value:number|null,[t1,t2]:[number,number],market:string){
 if(value==null||!Number.isFinite(value))return HEAT_MISSING
 const gain=market==='US'?['#196b42','#63b38b']:['#b3261e','#e8766d']
 const loss=market==='US'?['#b3261e','#e8766d']:['#1c5cab','#5598e7']
 if(value>=t2)return {bg:gain[0],ink:'#ffffff'}
 if(value>=t1)return {bg:gain[1],ink:'#202938'}
 if(value<=-t2)return {bg:loss[0],ink:'#ffffff'}
 if(value<=-t1)return {bg:loss[1],ink:'#202938'}
 return {bg:'#f0efec',ink:'#202938'}
}
