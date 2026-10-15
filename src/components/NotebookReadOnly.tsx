import {createElement,type ReactNode} from 'react'
import type {JSONContent} from '@tiptap/react'
import {cleanDocument} from '../lib/lifetimeJournal'
export function NotebookReadOnly({body}:{body:JSONContent}){
 function render(node:JSONContent,key:number):ReactNode{
  if(node.type==='text')return (node.marks||[]).reduce<ReactNode>((content,mark)=>createElement(({bold:'strong',italic:'em',underline:'u',strike:'s',code:'code'} as Record<string,string>)[mark.type]||'span',{},content),node.text||'')
  const tag=node.type==='heading'?'h'+node.attrs?.level:({doc:'div',paragraph:'p',bulletList:'ul',orderedList:'ol',listItem:'li',blockquote:'blockquote',hardBreak:'br',horizontalRule:'hr',codeBlock:'pre'} as Record<string,string>)[node.type||'']||'p'
  return createElement(tag,{key,...(node.type==='orderedList'?{start:node.attrs?.start}:{} )},...(node.content||[]).map(render))
 }
 return <div className="journal-prose notebook-readonly">{render(cleanDocument(body),0)}</div>
}
