export type DecisionTone = 'green'|'blue'|'amber'|'gray'|'positive'|'negative'

export type DecisionItem<T> = {
  key: string
  market?: string
  data: T
  rank?: string|number
  eyebrow?: string
  title: string
  meta?: string
  badge?: string
  badgeTone?: DecisionTone
  value?: string
  subvalue?: string
  valueTone?: DecisionTone
  ariaLabel?: string
}

export function DecisionList<T>({
  items,
  onSelect,
  className='',
  rowClassName='',
  emptyLabel='표시할 항목이 없습니다.'
}:{
  items:DecisionItem<T>[]
  onSelect:(data:T)=>void
  className?:string
  rowClassName?:string
  emptyLabel?:string
}){
  return <div className={('decision-list '+className).trim()} role="list">
    {items.map(item=><button
      key={item.key}
      data-market={item.market || (item.data as {market?:string})?.market || 'UNKNOWN'}
      type="button"
      role="listitem"
      className={('decision-row '+rowClassName).trim()}
      aria-label={item.ariaLabel}
      onClick={()=>onSelect(item.data)}
    >
      {item.rank!=null&&<span className="decision-rank">{item.rank}</span>}
      <span className="decision-main">
        {item.eyebrow&&<small className="decision-eyebrow">{item.eyebrow}</small>}
        <b>{item.title}</b>
        {item.meta&&<small>{item.meta}</small>}
      </span>
      {item.badge&&<span className={'decision-badge '+(item.badgeTone||'gray')}>{item.badge}</span>}
      {(item.value||item.subvalue)&&<span className={'decision-value '+(item.valueTone||'')}>
        {item.value&&<b>{item.value}</b>}
        {item.subvalue&&<small>{item.subvalue}</small>}
      </span>}
    </button>)}
    {!items.length&&<p className="empty">{emptyLabel}</p>}
  </div>
}
