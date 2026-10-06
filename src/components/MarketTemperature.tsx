import { useEffect, useMemo, useState } from 'react'
import { CHECKLIST_VERSION, TEMP_CATEGORIES, TEMP_ITEMS, changes, markedCount, previousOf, sortEntries, tempPosture, tempWord, temperature, upsertEntry, type TempEntry } from '../lib/temperature'

export type TempFact={label:string;value:string}
const today=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)}
const MARK_NAMES=['뜨거운 쪽','뜨거운 쪽에 가까움','중간','차가운 쪽에 가까움','차가운 쪽']

function Gauge({value,prev}:{value:number|null;prev:number|null}){
  return <div className="temp-gauge-wrap">
    <div className="temp-gauge" role="img" aria-label={value==null?'온도 없음':`온도 ${value}도`}>
      {prev!=null&&<i className="prev" style={{left:prev+'%'}}/>}
      {value!=null&&<i style={{left:value+'%'}}/>}
    </div>
    <div className="temp-scale"><span>냉각 · 공격</span><span>중립</span><span>과열 · 방어</span></div>
  </div>
}

function Headline({entry,prev}:{entry:TempEntry|null;prev:TempEntry|null}){
  const t=entry?temperature(entry.marks):null,p=prev?temperature(prev.marks):null
  if(t==null)return <div className="temp-headline"><div><small>{entry?entry.date+' 내 판단':'아직 기록이 없습니다'}</small><strong className="temp-value empty">—</strong></div></div>
  const delta=p==null?null:t-p
  return <div className="temp-headline">
    <div><small>{entry!.date} 내 판단 · {markedCount(entry!.marks)}/{TEMP_ITEMS.length} 항목</small><strong className={'temp-value '+(t>=60?'hot':t<40?'cold':'mid')}>{t}°</strong></div>
    <div className="temp-headline-side"><span className={'temp-posture '+(t>=60?'hot':t<40?'cold':'mid')}>{tempWord(t)} · {tempPosture(t)}</span>
      {delta!=null&&<small className="temp-delta">지난 판단({prev!.date.slice(5)}) {p}° → {delta>0?'+':''}{delta}°</small>}</div>
  </div>
}

// Dashboard card: latest entry, posture, change since the previous one.
export function TemperatureCard({entries,onOpen}:{entries:TempEntry[];onOpen:()=>void}){
  const sorted=sortEntries(entries),latest=sorted[0]||null,prev=sorted[1]||null
  const moved=latest?changes(latest,prev):[]
  return <section className={'panel temp-card'+(!latest?' empty':'')} aria-label="시장 온도계">
    <div className="panel-head"><div><h2>시장 온도계</h2><p>Howard Marks 점검표로 직접 매긴 시장 온도</p></div><button className="dashboard-section-action" onClick={onOpen}>{latest?'온도계 열기 →':'첫 온도 기록 →'}</button></div>
    {latest?<><Headline entry={latest} prev={prev}/><Gauge value={temperature(latest.marks)} prev={prev?temperature(prev.marks):null}/><p className="temp-moved">{moved.length?'바뀐 항목: '+moved.map(m=>m.item.label+(m.dir==='hotter'?' ▲':' ▼')).join(' · '):prev?'지난 판단과 같은 표시입니다.':'첫 기록입니다.'}</p></>:<div className="temp-empty"><span>아직 기록이 없습니다</span><small>필요할 때 직접 판단을 남기고 시장 온도의 변화를 비교합니다.</small></div>}
  </section>
}

export function MarketTemperature({entries,onChange,facts}:{entries:TempEntry[];onChange:(next:TempEntry[])=>void;facts:TempFact[]}){
  const sorted=useMemo(()=>sortEntries(entries),[entries])
  const [date,setDate]=useState(today)
  const base=sorted.find(e=>e.date===date)||null
  const prev=previousOf(sorted,date)
  // A new date starts from the previous entry's marks (evidence starts empty); an existing date edits that entry.
  const seed=():TempEntry=>base?{...base,marks:{...base.marks},evidence:{...base.evidence}}:{date,marks:{...(prev?.marks||{})},evidence:{},version:CHECKLIST_VERSION}
  const [draft,setDraft]=useState<TempEntry>(seed)
  useEffect(()=>{setDraft(seed())},[date,entries]) // eslint-disable-line react-hooks/exhaustive-deps
  const dirty=JSON.stringify(draft.marks)!==JSON.stringify(base?.marks||(prev?.marks||{}))||JSON.stringify(draft.evidence)!==JSON.stringify(base?.evidence||{})||!base
  const setMark=(key:string,v:number)=>setDraft(d=>({...d,marks:{...d.marks,[key]:v}}))
  const clearMark=(key:string)=>setDraft(d=>{const marks={...d.marks};delete marks[key];return {...d,marks}})
  const setEvidence=(key:string,text:string)=>setDraft(d=>({...d,evidence:{...d.evidence,[key]:text}}))
  const save=()=>{const evidence=Object.fromEntries(Object.entries(draft.evidence).map(([k,v])=>[k,v.trim()]).filter(([,v])=>v));onChange(upsertEntry(sorted,{...draft,date,evidence,version:CHECKLIST_VERSION}))}
  const remove=()=>{if(base&&window.confirm(date+' 기록을 삭제할까요?'))onChange(sorted.filter(e=>e.date!==date))}
  const moved=changes(draft,prev)
  const movedKeys=new Map(moved.map(m=>[m.item.key,m.dir]))
  const t=temperature(draft.marks)

  return <div className="temp-page">
    <div className="page-note page-guide"><b>시장 온도계</b><span>Howard Marks의 시장 온도 점검표입니다. 항목마다 지금 시장이 뜨거운 쪽과 차가운 쪽 중 어디에 가까운지 직접 표시하고, 판단을 바꾼 항목에는 그날의 근거를 적습니다. 온도는 표시한 항목의 단순 평균이며 예측이나 매매 신호가 아닙니다. 회색 테두리는 지난 판단입니다.</span></div>
    <div className="temp-layout">
      <div className="temp-main">
        <section className="panel temp-summary">
          <Headline entry={{...draft,date}} prev={prev}/>
          <Gauge value={t} prev={prev?temperature(prev.marks):null}/>
          {facts.length>0&&<><p className="temp-facts-head">참고 사실 · 앱 데이터 (온도에 자동 반영하지 않음)</p>
          <div className="temp-facts">{facts.map(f=><div key={f.label}><b>{f.value}</b><span>{f.label}</span></div>)}</div></>}
        </section>
        <section className="panel temp-editor">
          <div className="temp-editor-head">
            <label>기록 날짜 <input type="date" value={date} max={today()} onChange={e=>e.target.value&&setDate(e.target.value)}/></label>
            <span className="temp-status">{base?'저장된 기록 수정':'새 기록'}{moved.length?` · 바뀐 항목 ${moved.length}`:''}</span>
          </div>
          {TEMP_CATEGORIES.map(cat=><div key={cat} className="temp-category">
            <h3>{cat}</h3>
            {TEMP_ITEMS.filter(i=>i.category===cat).map(item=>{
              const v=draft.marks[item.key],was=prev?.marks[item.key],dir=movedKeys.get(item.key)
              return <div key={item.key} className={'temp-row'+(dir?' moved':'')} data-item={item.key}>
                <div className="temp-row-head"><b>{item.label}</b>{dir&&<span className={'temp-badge '+dir}>{dir==='hotter'?'▲ 뜨거워짐':'▼ 식음'}</span>}{v!=null&&<button type="button" className="temp-clear" onClick={()=>clearMark(item.key)} aria-label={item.label+' 표시 지우기'}>지우기</button>}</div>
                <div className="temp-poles">
                  <span className="hot">{item.hot}</span>
                  <div className="temp-dots" role="radiogroup" aria-label={`${item.label}: ${item.hot} ↔ ${item.cold}`}>
                    {[0,1,2,3,4].map(n=><button key={n} type="button" role="radio" aria-checked={v===n} aria-label={MARK_NAMES[n]} className={'temp-dot'+(v===n?' on'+n:'')+(was===n&&v!==n?' was':'')} onClick={()=>setMark(item.key,n)}/>)}
                  </div>
                  <span className="cold">{item.cold}</span>
                </div>
                {(dir||draft.evidence[item.key])&&<input className="temp-evidence" placeholder="근거 (출처·수치)" aria-label={item.label+' 근거'} value={draft.evidence[item.key]||''} onChange={e=>setEvidence(item.key,e.target.value)}/>}
              </div>})}
          </div>)}
          <div className="temp-save">
            {base&&<button type="button" className="ghost" onClick={remove}>이 날짜 기록 삭제</button>}
            <button type="button" className="primary" disabled={!dirty||markedCount(draft.marks)===0} onClick={save}>{base?'기록 수정 저장':date===today()?'오늘 온도 기록하기':date+' 기록 저장'}</button>
          </div>
        </section>
      </div>
      <aside className="panel temp-history">
        <h2>기록 이력</h2>
        {sorted.length?<table><thead><tr><th>날짜</th><th>온도</th><th>자세</th><th>바뀐 항목</th></tr></thead><tbody>
          {sorted.map((e,i)=>{const v=temperature(e.marks);return <tr key={e.date} className={e.date===date?'on':''} onClick={()=>setDate(e.date)} tabIndex={0} onKeyDown={k=>{if(k.key==='Enter')setDate(e.date)}}>
            <td>{e.date}</td><td className="cell-num">{v==null?'—':v+'°'}</td><td>{v==null?'—':tempPosture(v)}</td><td className="cell-num">{changes(e,sorted[i+1]).length||'—'}</td></tr>})}
        </tbody></table>:<p className="note">아직 기록이 없습니다. 항목을 표시하고 저장하면 여기에 쌓입니다.</p>}
      </aside>
    </div>
  </div>
}
