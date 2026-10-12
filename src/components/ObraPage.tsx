import type { ReactNode } from 'react'
import { FolioWordmark } from './FolioWordmark'
import { Button } from './ui/button'

/** Product content from the approved Modern Magazine preview, without its device frame. */
export function ObraMasthead({label,onMenu,onBack}:{label:string;onMenu:()=>void;onBack?:()=>void}) {
  return <header className="obra-masthead">{onBack?<Button variant="ghost" className="journey-back obra-back" aria-label="← 탐색 목록" onClick={onBack}><span className="obra-back-cue" aria-hidden="true">‹</span><FolioWordmark/></Button>:<FolioWordmark/>}<Button variant="ghost" aria-label="전체 메뉴 열기" aria-haspopup="dialog" onClick={onMenu}>{label}</Button></header>
}
export function ObraOverview({conclusion,onWrite,children}:{conclusion?:string;onWrite:()=>void;children:ReactNode}) {
  return <section className="obra-overview" aria-label="기업과 나의 판단">
    <header className="obra-feature"><span>FOLIO INSIGHT</span><h3>성장을 넘어,<br/>지속성을 묻다.</h3><p>좋은 기업을 발견하는 일과<br/>좋은 투자 판단을 내리는 일.</p></header>
    <section className="obra-thesis-preview" aria-label="Thesis 미리보기"><span>MY THESIS</span><h3>나의 판단</h3>
      <div className="obra-question"><span>{conclusion?'내 결론':'다음에 확인할 질문'}</span><Button variant="secondary" className="obra-question-link" onClick={onWrite} aria-label="Thesis에서 내 판단 작성">{conclusion||'어떤 증거가 생각을 바꿀까?'}</Button></div>
      {children}
    </section>
  </section>
}
