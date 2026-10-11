import type { EditableRow, LeaderRow } from '../types'
function httpUrl(value:unknown){try{const url=new URL(String(value||''));return /^https?:$/.test(url.protocol)?url:null}catch{return null}}
/** Public source drafts and explicit saved research; provider status is disclosed per observation. */
export function leaderObservation(row: LeaderRow, research: EditableRow[]) {
 return research.map<EditableRow>(note => ({ ...note, verification: note.verification || (note.verified === false ? '반박됨' : note.verified === true ? '확인됨' : '미검증') })).filter(note => String(note.market) === row.market && String(note.ticker).trim().toUpperCase() === row.ticker.toUpperCase()
  && httpUrl(note.source) && String(note.fact || '').trim() && note.verification !== '반박됨')
  .slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))[0]
}
