import { FolioMark } from './FolioMark'

export function FolioWordmark({className=''}:{className?:string}){
  return <span className={('folio-wordmark-system '+className).trim()} role="img" aria-label="Folio xx">
    <span className="folio-wordmark-text" aria-hidden="true">Folio</span>
    <span className="folio-wordmark-mark" aria-hidden="true"><FolioMark/></span>
  </span>
}
