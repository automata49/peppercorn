import type { ReactNode } from 'react'
import { coverPhoto, useVisualStyle } from './VisualStyle'

/** Canonical copy for the three top-level editorial destinations. */
export const editorialPageHeadings = {
 discover: {kicker:'DISCOVER',title:'변화하는 세상을 읽다',description:'기업을 발견하고, 나의 관점으로 남기는 시간.'},
 journal: {kicker:'MY PAGES',title:'기록, 일상, 투자',description:'관찰, 판단, 그리고 일상의 아름다움.'},
 journey: {kicker:'A LIFETIME IN PAGES',title:'그때의 나, 지금의 나',description:'가설과 투자 방향을 재점검하고, 새로운 증거에 대응합니다.'},
} as const

export function SectionHeading({kind,kicker,title,description,children}:{kind:'discover'|'journal'|'journey';kicker:string;title:string;description:string;children?:ReactNode}){
 const {photoStyle}=useVisualStyle()
 return <header className={"lifetime-heading section-heading"+(kind==='discover'?' discovery-heading':'')}><div><span className="journey-kicker">{kicker}</span><h2>{title}</h2><p>{description}</p>{children}</div><img src={coverPhoto(kind,photoStyle)} alt=""/></header>
}
