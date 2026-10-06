import {useId} from 'react'

/**
 * Folio xx master mark.
 * Geometry follows the approved B board: two interlocked X strokes with a
 * centered negative diamond. The first X inherits the surrounding ink/white
 * through currentColor before moving into Plum; the second X runs
 * Magenta → Coral → Amber.
 */
export function FolioMark({className=''}:{className?:string}){
  const raw=useId().replace(/:/g,'')
  const left='folio-left-'+raw
  const right='folio-right-'+raw
  const cut='folio-cut-'+raw
  return <svg className={('folio-xx-vector '+className).trim()} viewBox="0 0 184 104" role="presentation" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={left} gradientUnits="userSpaceOnUse" x1="0" y1="12" x2="108" y2="92">
        <stop offset="0%" stopColor="currentColor"/>
        <stop offset="54%" stopColor="#54265F"/>
        <stop offset="100%" stopColor="#A34F78"/>
      </linearGradient>
      <linearGradient id={right} gradientUnits="userSpaceOnUse" x1="82" y1="82" x2="184" y2="12">
        <stop offset="0%" stopColor="#A34F78"/>
        <stop offset="58%" stopColor="#F06A45"/>
        <stop offset="100%" stopColor="#F7A24A"/>
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
