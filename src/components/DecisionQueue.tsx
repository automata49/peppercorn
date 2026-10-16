import {motion} from 'motion/react'
import {Button} from './ui/button'
import type {JournalEntry} from '../lib/lifetimeJournal'
import {currentJudgement,latestReview,reviewLabels,reviewStatus} from '../lib/decisionReview'
export function DecisionQueue({entries,view='list',limit,onMore,onReview,onOpenOriginal}:{entries:JournalEntry[];view?:'card'|'list';limit:number;onMore:()=>void;onReview:(e:JournalEntry)=>void;onOpenOriginal:(e:JournalEntry)=>void}){
 return <><div className={`decision-queue decision-queue--${view}`} aria-label="판단 점검 대기열">{entries.slice(0,limit).map(e=>{
  const last=latestReview(e),status=reviewStatus(e),original=e.revisions[0]?.snapshot||e,nextDate=status==='closed'?'':e.reviewDate
  return <motion.article key={e.id} layoutId={`frame-review-${e.id}`} className="review-gallery-item decision-queue-item" aria-label={`${e.title} 판단`}>
   <header><span>{e.ticker?.replace(/^US:/,'')||'투자 판단'}</span><span className="decision-status" data-status={status}>{reviewLabels[status]}</span></header>
   <h4>{e.title}</h4><p className="decision-queue-judgement">{currentJudgement(e).slice(0,180)||'가설을 정리하고 점검을 시작하세요.'}</p>
   <dl><div><dt>{nextDate?'다음 점검':'최근 판단'}</dt><dd><time dateTime={nextDate||last?.at||e.createdAt}>{nextDate||new Date(last?.at||e.createdAt).toLocaleDateString('ko-KR')}</time></dd></div>{last?.trigger&&status!=='closed'&&<div><dt>확인할 조건</dt><dd>{last.trigger}</dd></div>}</dl>
   <div className="decision-queue-actions"><Button onClick={()=>onReview(e)}>{status==='closed'?'검토 다시 열기':'재검토하기'}</Button><Button variant="ghost" aria-label={`${e.title} 기록 열기`} onClick={()=>onOpenOriginal(e)}>원본 기록</Button></div>
   {(e.revisions.length>0||last)&&<details className="journey-revision"><summary>{last?`판단 변화 · ${e.reflections?.length||0}회`:'원본 판단 비교'}</summary><div className="journey-judgement" aria-label={`${e.title} 판단 비교`}><section><h5>처음의 판단</h5><time>{new Date(e.createdAt).toLocaleString('ko-KR')}</time><p>{original.hypothesis||original.text||original.answer||'별도 가설 없음'}</p>{original.counterEvidence&&<p>반대 증거 · {original.counterEvidence}</p>}</section><section><h5>현재 기준</h5><time>{new Date(last?.at||e.updatedAt).toLocaleString('ko-KR')}</time><p>{currentJudgement(e)||'별도 가설 없음'}</p>{last?.result&&<p>최근 증거 · {last.result}</p>}</section></div></details>}
  </motion.article>
 })}</div>{entries.length>limit&&<Button variant="secondary" onClick={onMore}>판단 더 보기 · {entries.length-limit}개</Button>}</>
}
