import type { ReactNode } from 'react'
import { coverPhoto, useVisualStyle } from './VisualStyle'

export function SectionHeading({kind,kicker,title,description,children}:{kind:'discover'|'journal'|'journey';kicker:string;title:string;description:string;children?:ReactNode}){
 const {photoStyle}=useVisualStyle()
 return <header className={"lifetime-heading section-heading"+(kind==='discover'?' discovery-heading':'')}><div><span className="journey-kicker">{kicker}</span><h2>{title}</h2><p>{description}</p>{children}</div><img src={coverPhoto(kind,photoStyle)} alt=""/></header>
}
