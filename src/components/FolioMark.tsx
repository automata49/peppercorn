import {useId} from 'react'

export function FolioMark({className=''}:{className?:string}){
  const raw=useId().replace(/:/g,'')
  const left='folio-left-'+raw
  const right='folio-right-'+raw
  return <svg className={('folio-xx-vector '+className).trim()} viewBox="0 0 172 100" role="presentation" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={left} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="currentColor"/>
        <stop offset="52%" stopColor="#54265F"/>
        <stop offset="100%" stopColor="#A34F78"/>
      </linearGradient>
      <linearGradient id={right} x1="0" y1="1" x2="1" y2="0">
        <stop offset="0%" stopColor="#A34F78"/>
        <stop offset="56%" stopColor="#F06A45"/>
        <stop offset="100%" stopColor="#F5A24A"/>
      </linearGradient>
    </defs>
    <g fill={'url(#'+left+')'}>
      <path d="M0 0h32l62 100H62z"/>
      <path d="M62 0h32L32 100H0z"/>
    </g>
    <g fill={'url(#'+right+')'}>
      <path d="M78 0h32l62 100h-32z"/>
      <path d="M140 0h32l-62 100H78z"/>
    </g>
    <path d="M78 0h16l16 26-16 26-16-26z" fill="#54265F" opacity=".94"/>
    <path d="M78 100h16l16-26-16-26-16 26z" fill="#A34F78" opacity=".96"/>
  </svg>
}
