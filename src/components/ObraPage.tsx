import type { ReactNode } from 'react'
import { Button } from './ui/button'

/** Product content from the approved Modern Magazine preview, without its device frame. */
export function ObraMasthead({label,onMenu,onBack}:{label:string;onMenu:()=>void;onBack?:()=>void}) {
  return <header className="obra-masthead">{onBack&&<Button variant="ghost" className="journey-back obra-back" aria-label="뒤로 가기" onClick={onBack}><span className="obra-back-cue" aria-hidden="true">‹</span><span className="obra-back-label">뒤로</span></Button>}<Button variant="ghost" aria-label="전체 메뉴 열기" aria-haspopup="dialog" onClick={onMenu}>{label}</Button></header>
}
export function ObraOverview({children}:{children:ReactNode}) {
  return <section className="obra-overview" aria-label="기업과 나의 판단">
    <header><h3>한눈에 보기</h3><p>핵심 신호를 확인하고, 나의 판단은 Thesis에 기록하세요.</p></header>
    {children}
  </section>
}
