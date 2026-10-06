export function FolioWordmark({className=''}:{className?:string}){
  return <span className={('folio-wordmark-system '+className).trim()} role="img" aria-label="Folio xx">
    <img className="folio-wordmark-image folio-wordmark-image-light" src="./folio-brand-wordmark-light.webp?v=u2" alt="" draggable={false}/>
    <img className="folio-wordmark-image folio-wordmark-image-dark" src="./folio-brand-wordmark-dark.webp?v=u2" alt="" draggable={false}/>
  </span>
}
