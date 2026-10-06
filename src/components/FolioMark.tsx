import {useId} from 'react'

/**
 * Folio xx master mark.
 * Geometry follows the approved B board: two interlocked lowercase-scale x
 * strokes with a centered negative diamond. Colour is fixed to the B palette
 * so the mark never changes hue between Home, launch, drawer or dark mode.
 * Visible size is controlled by CSS at the font x-height (≈ the “o” height).
 */
export function FolioMark({className=''}:{className?:string}){
  const raw=useId().replace(/:/g,'')
  const left='folio-left-'+raw
  const right='folio-right-'+raw
  const cut='folio-cut-'+raw
  return <svg className={('folio-xx-vector '+className).trim()} viewBox="0 0 184 104" role="presentation" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={left} gradientUnits="userSpaceOnUse" x1="0" y1="12" x2="108" y2="92">
        <stop offset="0%" stopColor="var(--folio-brand-plum,#54265f)"/>
        <stop offset="58%" stopColor="var(--folio-brand-plum,#54265f)"/>
        <stop offset="100%" stopColor="var(--folio-brand-magenta,#a34f78)"/>
      </linearGradient>
      <linearGradient id={right} gradientUnits="userSpaceOnUse" x1="82" y1="82" x2="184" y2="12">
        <stop offset="0%" stopColor="var(--folio-brand-magenta,#a34f78)"/>
        <stop offset="58%" stopColor="var(--folio-brand-coral,#f06a45)"/>
        <stop offset="100%" stopColor="var(--folio-brand-amber,#f5a24a)"/>
      </linearGradient>
      <mask id={cut}>
        <rect width="184" height="104" fill="white"/>
        <path d="M92 33 111 52 92 71 73 52Z" fill="black"/>
      </mask>
    </defs>
    <g mask={'url(#'+cut+')'}>
      <g fill={'url(#'+left+')'}>
        <path d="M0 0h31l68 104H66z"/>
        <path d="M66 0h33L31 104H0z"/>
      </g>
      <g fill={'url(#'+right+')'}>
        <path d="M85 0h33l66 104h-32z"/>
        <path d="M151 0h33l-66 104H85z"/>
      </g>
    </g>
  </svg>
}
