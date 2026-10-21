import {useEffect,useRef,useState} from 'react'

export type FilterWheelOption = {value:string;label:string;disabled?:boolean}

/** Physical-size, touch/keyboard-accessible vertical wheel. Preview follows motion;
 *  selection commits only after the scroll settles. */
export function FilterWheel({label,value,options,onChange,className=''}:{label:string;value:string;options:FilterWheelOption[];onChange:(value:string)=>void;className?:string}){
  const viewport=useRef<HTMLDivElement>(null)
  const settle=useRef<ReturnType<typeof setTimeout>|null>(null)
  const autoReset=useRef<ReturnType<typeof setTimeout>|null>(null)
  const autoScroll=useRef(false),userScrolling=useRef(false)
  const active=Math.max(0,options.findIndex(option=>option.value===value))
  const [preview,setPreview]=useState(active)

  const nearest=()=>{
    const rail=viewport.current
    if(!rail)return null
    const center=rail.scrollTop+rail.clientHeight/2
    return options.map((option,i)=>({option,i,button:rail.querySelector<HTMLButtonElement>(`[data-wheel-index="${i}"]`)}))
      .filter(item=>!item.option.disabled&&item.button)
      .sort((a,b)=>Math.abs(a.button!.offsetTop+a.button!.offsetHeight/2-center)-Math.abs(b.button!.offsetTop+b.button!.offsetHeight/2-center))[0]||null
  }
  useEffect(()=>{
    const rail=viewport.current
    const button=rail?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
    setPreview(active)
    if(!rail||!button)return
    autoScroll.current=true
    if(autoReset.current)clearTimeout(autoReset.current)
    rail.scrollTo({top:Math.max(0,button.offsetTop+button.offsetHeight/2-rail.clientHeight/2),behavior:'auto'})
    autoReset.current=setTimeout(()=>{autoScroll.current=false},180)
    return()=>{if(autoReset.current)clearTimeout(autoReset.current)}
  },[value,options.length,active])
  useEffect(()=>()=>{if(settle.current)clearTimeout(settle.current);if(autoReset.current)clearTimeout(autoReset.current)},[])

  const settleScroll=()=>{
    const current=nearest()
    if(!current)return
    setPreview(current.i)
    if(autoScroll.current||!userScrolling.current)return
    if(settle.current)clearTimeout(settle.current)
    settle.current=setTimeout(()=>{
      const item=nearest()
      userScrolling.current=false
      if(item&&item.option.value!==value)onChange(item.option.value)
    },180)
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
        data-offset={Math.max(-3,Math.min(3,i-preview))} aria-pressed={option.value===value} data-preview={i===preview}
        disabled={option.disabled} onClick={()=>{userScrolling.current=false;setPreview(i);if(settle.current)clearTimeout(settle.current);onChange(option.value)}}>
        <span className="catalog-wheel-option-label">{option.label}</span>
      </button>)}
    </div>
  </div>
}
