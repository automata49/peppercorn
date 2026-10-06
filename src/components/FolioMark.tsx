import {useId} from 'react'

export function FolioMark({className=''}:{className?:string}){
  const raw=useId().replace(/:/g,'')
  const left='folio-left-'+raw
  const right='folio-right-'+raw
  const mask='folio-cut-'+raw
  return <svg className={('folio-xx-vector '+className).trim()} viewBox="0 0 184 100" role="presentation" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={left} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="currentColor"/>
        <stop offset="48%" stopColor="#54265F"/>
        <stop offset="100%" stopColor="#A34F78"/>
      </linearGradient>
      <linearGradient id={right} x1="0" y1="1" x2="1" y2="0">
        <stop offset="0%" stopColor="#54265F"/>
        <stop offset="44%" stopColor="#A34F78"/>
        <stop offset="72%" stopColor="#F06A45"/>
        <stop offset="100%" stopColor="#F7A24A"/>
      </linearGradient>
      <mask id={mask}>
        <rect width="184" height="100" fill="white"/>
        <path d="M100 31 119 50 100 69 81 50Z" fill="black"/>
      </mask>
    </defs>
    <g mask={'url(#'+mask+')'}>
      <g fill={'url(#'+left+')'}>
        <path d="M0 0h36l64 100H64z"/>
        <path d="M64 0h36L36 100H0z"/>
      </g>
      <g fill={'url(#'+right+')'}>
        <path d="M84 0h36l64 100h-36z"/>
        <path d="M148 0h36l-64 100H84z"/>
      </g>
    </g>
  </svg>
}
