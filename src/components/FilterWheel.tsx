import {useEffect,useRef} from 'react'

export type FilterWheelOption = {value:string;label:string;disabled?:boolean}

/** Touch-native vertical picker: the middle row is the selected value. */
export function FilterWheel({label,value,options,onChange,className=''}:{label:string;value:string;options:FilterWheelOption[];onChange:(value:string)=>void;className?:string}){
  const viewport=useRef<HTMLDivElement>(null)
  const settle=useRef<ReturnType<typeof setTimeout>|null>(null)
  const autoReset=useRef<ReturnType<typeof setTimeout>|null>(null)
  const autoScroll=useRef(false)
  const userScrolling=useRef(false)
  const active=options.findIndex(option=>option.value===value)
  const index=active<0?0:active

  useEffect(()=>{
    const rail=viewport.current
    const button=rail?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
    if(!rail||!button)return
    // Programmatic centering must not select a neighboring filter option.
    autoScroll.current=true
    if(autoReset.current)clearTimeout(autoReset.current)
    rail.scrollTo({top:Math.max(0,button.offsetTop-(rail.clientHeight-button.clientHeight)/2),behavior:'auto'})
    autoReset.current=setTimeout(()=>{autoScroll.current=false},300)
    return()=>{if(autoReset.current)clearTimeout(autoReset.current)}
  },[value,options.length])

  useEffect(()=>()=>{if(settle.current)clearTimeout(settle.current);if(autoReset.current)clearTimeout(autoReset.current)},[])

  const settleScroll=()=>{
    if(autoScroll.current||!userScrolling.current)return
    if(settle.current)clearTimeout(settle.current)
    settle.current=setTimeout(()=>{
      const rail=viewport.current
      if(!rail)return
      const center=rail.scrollTop+rail.clientHeight/2
      const nearest=options.map((option,i)=>({option,button:rail.querySelector<HTMLButtonElement>(`[data-wheel-index="${i}"]`)}))
        .filter(item=>!item.option.disabled&&item.button)
        .sort((a,b)=>Math.abs(a.button!.offsetTop+a.button!.clientHeight/2-center)-Math.abs(b.button!.offsetTop+b.button!.clientHeight/2-center))[0]
      userScrolling.current=false
      if(nearest&&nearest.option.value!==value)onChange(nearest.option.value)
    },170)
  }
  const changeStep=(step:number)=>{
    const current=options.findIndex(option=>option.value===value)
    for(let i=current+step;i>=0&&i<options.length;i+=step){
      if(!options[i].disabled){userScrolling.current=false;if(settle.current)clearTimeout(settle.current);onChange(options[i].value);break}
    }
  }

  return <div className="catalog-wheel" data-wheel={label}>
    <div className="catalog-wheel-heading"><span>{label}</span></div>
    <div className={'catalog-wheel-track '+className} ref={viewport}
      role="group" aria-label={label}
      onPointerDown={()=>{autoScroll.current=false;userScrolling.current=true}}
      onWheel={()=>{autoScroll.current=false;userScrolling.current=true}}
      onScroll={settleScroll}
      onKeyDown={e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();changeStep(e.key==='ArrowDown'?1:-1)}}}>
      {options.map((option,i)=><button key={option.value} type="button" data-wheel-index={i}
        data-offset={Math.max(-3,Math.min(3,i-index))} aria-pressed={option.value===value}
        disabled={option.disabled} onClick={()=>{userScrolling.current=false;if(settle.current)clearTimeout(settle.current);onChange(option.value)}}>
        {option.label}
      </button>)}
    </div>
  </div>
}
