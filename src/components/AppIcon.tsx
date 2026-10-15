export type AppIconName =
  | 'home'
  | 'analysis'
  | 'temperature'
  | 'watchlist'
  | 'portfolio'
  | 'journal'
  | 'leaderboard'
  | 'universe'
  | 'settings'
  | 'sectors'
  | 'menu'
  | 'close'
  | 'refresh'
  | 'search'
  | 'arrow'
  | 'basket'
  | 'pen' | 'pencil' | 'highlighter' | 'eraser' | 'selection' | 'text' | 'photo' | 'undo' | 'redo' | 'paper' | 'back'

const common={
  fill:'none',
  stroke:'currentColor',
  strokeWidth:1.55,
  strokeLinecap:'round' as const,
  strokeLinejoin:'round' as const
}

export function AppIcon({name,size=20,className=''}:{name:AppIconName;size?:number;className?:string}){
  const body=(()=>{
    switch(name){
      case 'pen': return <><path d="m4 20 2-7L17 2l5 5-11 11-7 2Z"/><path d="m6 13 5 5M14 5l5 5M4 20l5-5"/></>
      case 'pencil': return <><path d="m4 20 2-6L17 3l4 4-11 11-6 2Z"/><path d="m6 14 4 4M15 5l4 4"/></>
      case 'highlighter': return <><path d="m5 13 9-10 7 7-10 9-6-6ZM5 13l-3 5 4 4 5-3M2 22h12"/><path d="m12 5 7 7"/></>
      case 'eraser': return <><path d="m3 13 10-10 8 8-10 10H7l-4-4v-4Z"/><path d="m8 8 8 8M11 21h10"/></>
      case 'selection': return <><rect x="4" y="4" width="16" height="16" rx="1" strokeDasharray="2 3"/><path d="M3 3h3v3H3zM18 3h3v3h-3zM3 18h3v3H3zM18 18h3v3h-3z"/></>
      case 'text': return <><path d="M4 5h16M12 5v15M8 20h8M4 5v3M20 5v3"/></>
      case 'photo': return <><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/></>
      case 'undo': return <><path d="m8 4-5 5 5 5M3 9h11a6 6 0 0 1 0 12h-3"/></>
      case 'redo': return <><path d="m16 4 5 5-5 5M21 9H10a6 6 0 0 0 0 12h3"/></>
      case 'paper': return <><path d="M5 3h10l4 4v14H5V3ZM15 3v5h4M8 12h8M8 16h8"/></>
      case 'back': return <><path d="m11 5-7 7 7 7M4 12h16"/></>
      case 'basket': return <><path d="m3 8 2 12h14l2-12H3Z"/><path d="m8 8 4-6 4 6M9 12v4m6-4v4"/></>
      case 'arrow': return <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>
      case 'home': return <><path d="M4 10.5 12 4l8 6.5"/><path d="M6.5 9.5V20h11V9.5"/><path d="M10 20v-5h4v5"/></>
      case 'analysis': return <><path d="M5 19V12"/><path d="M12 19V5"/><path d="M19 19V9"/><path d="M3.5 19.5h17"/></>
      case 'temperature': return <><path d="M12 3a8 8 0 1 0 8 8"/><path d="M12 11l5-4"/><circle cx="12" cy="11" r="1.7"/></>
      case 'watchlist': return <path d="m12 3 2.75 5.57 6.15.9-4.45 4.33 1.05 6.12L12 17.03 6.5 19.92l1.05-6.12L3.1 9.47l6.15-.9L12 3Z"/>
      case 'portfolio': return <><rect x="3.5" y="7" width="17" height="12" rx="2"/><path d="M8.5 7V5.5A1.5 1.5 0 0 1 10 4h4a1.5 1.5 0 0 1 1.5 1.5V7"/><path d="M3.5 12h17"/><path d="M10 12v2h4v-2"/></>
      case 'journal': return <><path d="M6 4h11a2 2 0 0 1 2 2v14H8a3 3 0 0 1-3-3V5a1 1 0 0 1 1-1Z"/><path d="M8 4v16"/><path d="M11 8h5M11 12h5"/></>
      case 'leaderboard': return <><path d="M4 17 9 12l3.5 3.5L20 8"/><path d="M15 8h5v5"/></>
      case 'universe': return <><circle cx="12" cy="12" r="8.5"/><path d="M3.8 12h16.4M12 3.5c2.2 2.3 3.3 5.1 3.3 8.5S14.2 18.2 12 20.5M12 3.5C9.8 5.8 8.7 8.6 8.7 12s1.1 6.2 3.3 8.5"/></>
      case 'settings': return <><circle cx="12" cy="12" r="2.8"/><path d="M19.2 13.7a7.7 7.7 0 0 0 .05-3.4l2-1.55-2-3.45-2.45 1a8 8 0 0 0-2.95-1.7L13.5 2h-4l-.35 2.6A8 8 0 0 0 6.2 6.3l-2.45-1-2 3.45 2 1.55a7.7 7.7 0 0 0 .05 3.4l-2.05 1.55 2 3.45 2.5-1a8 8 0 0 0 2.9 1.7L9.5 22h4l.35-2.6a8 8 0 0 0 2.9-1.7l2.5 1 2-3.45-2.05-1.55Z"/></>
      case 'sectors': return <><rect x="4" y="4" width="6" height="6" rx="1.2"/><rect x="14" y="4" width="6" height="6" rx="1.2"/><rect x="4" y="14" width="6" height="6" rx="1.2"/><rect x="14" y="14" width="6" height="6" rx="1.2"/></>
      case 'menu': return <><path d="M4 7h16M4 12h16M4 17h16"/></>
      case 'close': return <><path d="m6 6 12 12M18 6 6 18"/></>
      case 'refresh': return <><path d="M20 6v5h-5"/><path d="M18.2 9A7 7 0 1 0 19 15"/></>
      case 'search': return <><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></>
    }
  })()
  return <svg className={('app-icon '+className).trim()} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...common}>{body}</svg>
}
