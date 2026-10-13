import { useEffect, useState } from 'react'
import { useVisualStyle, coverPhoto } from './VisualStyle'

export const editorialStyles = [
  ['modern', '모던 매거진', '명확한 고딕 제목과 여백'],
  ['classic', '클래식 에디토리얼', '명조 제목과 차분한 문장'],
  ['art', '아트 저널', '굵은 제목과 강한 대비'],
] as const
type EditorialStyle = typeof editorialStyles[number][0]
const valid = (value: unknown): value is EditorialStyle => editorialStyles.some(([key]) => key === value)
export function useEditorialStyle() {
  const [style, setStyle] = useState<EditorialStyle>(() => {
    try { const saved = localStorage.getItem('folio-editorial-style'); return valid(saved) ? saved : 'modern' } catch { return 'modern' }
  })
  useEffect(() => {
    document.documentElement.dataset.editorial = style
    try { localStorage.setItem('folio-editorial-style', style) } catch { /* Device preference remains usable in memory. */ }
  }, [style])
  return [style, setStyle] as const
}
export function TypographySettings({ style, onChange }: { style: EditorialStyle; onChange: (value: EditorialStyle) => void }) {
  const {photoStyle,setPhotoStyle}=useVisualStyle()
  return <section className="panel typography-settings" aria-label="매거진 타이포그래피">
    <h2>사진과 타이포그래피</h2>
    <div className="visual-style-options" role="group" aria-label="사진과 글자 스타일">{(['film','vivid'] as const).map(value=><button key={value} type="button" aria-pressed={photoStyle===value} onClick={()=>{setPhotoStyle(value);onChange(value==='vivid'?'art':'modern')}}><img src={coverPhoto('discover',value)} alt=""/><b>{value==='film'?'Film · 모던 매거진':'Vivid · 아트 저널'}</b><span>{value==='film'?'기존의 차분한 사진과 고딕 제목':'선명한 새 사진과 굵은 제목'}</span></button>)}</div>
    <label>제목 스타일<select value={style} onChange={e => { if (valid(e.target.value)) onChange(e.target.value) }}>
      {editorialStyles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select></label>
    <p className="typography-sample">발견은 작은 질문에서 시작된다.</p>
    <p className="note">{editorialStyles.find(([key]) => key === style)?.[2]} · 홈, 페이지 제목, 종목명과 핵심 문구에 함께 적용됩니다.</p>
  </section>
}
