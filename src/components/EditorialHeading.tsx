import type {ReactNode} from 'react'

/** Folio Insight is the Level-2 reference: English kicker → Korean title → quiet meta. */
export function EditorialHeading({kicker,title,meta,level=3}:{kicker:string;title:string;meta?:ReactNode;level?:2|3}){
 const Heading=level===2?'h2':'h3'
 return <header className="folio-editorial-heading">
   <div><span className="folio-editorial-kicker">{kicker}</span><Heading>{title}</Heading></div>
   {meta&&<small className="folio-editorial-meta">{meta}</small>}
 </header>
}
