import type {JournalEntry,Reflection} from './lifetimeJournal'
export const reviewLabels={due:'지금 점검',planned:'점검 예정',done:'점검 완료',closed:'검토 종료'}
export function latestReview(entry:JournalEntry,include:(r:Reflection)=>boolean=()=>true):Reflection|undefined{return entry.reflections?.reduce<Reflection|undefined>((latest,r)=>include(r)&&(!latest||Date.parse(r.at)>=Date.parse(latest.at))?r:latest,undefined)}
export function currentJudgement(entry:JournalEntry){return latestReview(entry,r=>!!r.judgement?.trim())?.judgement?.trim()||entry.hypothesis?.trim()||entry.text?.trim()||entry.answer?.trim()||''}
export function reviewStatus(entry:JournalEntry,today=new Date().toLocaleDateString('sv-SE')):keyof typeof reviewLabels{
 const last=latestReview(entry)
 if(last?.outcome==='close')return 'closed'
 if(entry.reviewDate)return entry.reviewDate<=today?'due':'planned'
 if(last?.trigger?.trim())return 'planned'
 return last?'done':'due'
}
export function decisionActivityDate(entry:JournalEntry){return (reviewStatus(entry)==='closed'?'':entry.reviewDate)||latestReview(entry)?.at||entry.createdAt}
export function reviewOrder(a:JournalEntry,b:JournalEntry){const priority={due:0,planned:1,done:2,closed:3};return priority[reviewStatus(a)]-priority[reviewStatus(b)]||((reviewStatus(a)==='closed'?'':a.reviewDate)||'9999-12-31').localeCompare((reviewStatus(b)==='closed'?'':b.reviewDate)||'9999-12-31')||(Date.parse(b.updatedAt)-Date.parse(a.updatedAt))||a.id.localeCompare(b.id)}
export function decisionSearch(entry:JournalEntry){const last=latestReview(entry);return [currentJudgement(entry),last?.result,last?.trigger,last?.nextAction,last?.lesson,last?.note?.text].join(' ')}
