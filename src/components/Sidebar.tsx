import { useEffect, useState } from 'react'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from './ui/dialog'
import { AppIcon, type AppIconName } from './AppIcon'
import { FolioWordmark } from './FolioWordmark'

const pages:[string,AppIconName,string][]=[
  ['today','home','오늘'],
  ['analysis','search','발견'],
  ['notebook','journal','저널'],
  ['tracking','watchlist','여정'],
  ['thesis','journal','Thesis'],
  ['dashboard','analysis','시장 요약'],
  ['signal','sectors','시장 신호'],
  ['temperature','temperature','시장 온도계'],
  ['watchlist','watchlist','Watchlist'],
  ['portfolio','portfolio','Portfolio'],
  ['journal','journal','매매 기록'],
  ['research','journal','리서치 노트'],
  ['leaderboard','leaderboard','Leaderboard'],
  ['universe','universe','Universe'],
  ['settings','settings','Settings']
]
const pageGroups=[
  ['핵심',['today','analysis','notebook','tracking']],
  ['시장',['dashboard','signal','temperature']],
  ['기록과 추적',['thesis','research','watchlist','portfolio','journal']],
  ['전체 데이터',['leaderboard','universe','settings']]
] as const

type ThemeMode='system'|'light'|'dark'
const THEME_KEY='folio-theme'
const themeLabels:Record<ThemeMode,string>={system:'System',light:'Light',dark:'Dark'}

function readTheme():ThemeMode{
  try{
    const saved=window.localStorage.getItem(THEME_KEY)
    return saved==='light'||saved==='dark'||saved==='system'?saved:'light'
  }catch{
    return 'light'
  }
}

function resolvedTheme(mode:ThemeMode){
  return mode==='system'
    ?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')
    :mode
}

function applyTheme(mode:ThemeMode){
  const root=document.documentElement
  if(mode==='system')root.removeAttribute('data-theme')
  else root.dataset.theme=mode
  root.dataset.themeMode=mode
  const resolved=resolvedTheme(mode)
  root.style.colorScheme=resolved
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    ?.setAttribute('content',resolved==='dark'?'#0a0a0c':'#f4f1ec')
}

function ThemeControl({value,onChange}:{value:ThemeMode;onChange:(mode:ThemeMode)=>void}){
  return <div className="theme-control" role="group" aria-label="화면 테마">
    {(Object.keys(themeLabels) as ThemeMode[]).map(mode=>
      <button
        key={mode}
        type="button"
        aria-pressed={value===mode}
        onClick={()=>onChange(mode)}
      >{themeLabels[mode]}</button>
    )}
  </div>
}

function FolioBrand(){
  return <FolioWordmark/>
}

export function Sidebar({page,setPage,open,setOpen,onRefresh,refreshing}:{page:string;setPage:(p:string)=>void;open:boolean;setOpen:(open:boolean)=>void;onRefresh:()=>void;refreshing:boolean}){
  const [theme,setTheme]=useState<ThemeMode>(readTheme)

  useEffect(()=>{
    applyTheme(theme)
    try{window.localStorage.setItem(THEME_KEY,theme)}catch{}
    if(theme!=='system')return
    const media=window.matchMedia('(prefers-color-scheme: dark)')
    const handle=()=>applyTheme('system')
    media.addEventListener?.('change',handle)
    return ()=>media.removeEventListener?.('change',handle)
  },[theme])

  const pageButton=([id,icon,label]:[string,AppIconName,string])=><button key={id} className={page===id?'active':''} onClick={()=>{setPage(id);setOpen(false)}} aria-current={page===id?'page':undefined}>
    <span className="nav-icon"><AppIcon name={icon}/></span><span className="nav-label">{label}</span>
  </button>
  const navigation=<nav aria-label="주 메뉴">{pages.map(pageButton)}</nav>
  const drawerNavigation=<nav className="menu-nav" aria-label="주 메뉴">{pageGroups.map(([title,ids])=><section className="menu-nav-group" key={title}>
    <h3>{title}</h3>
    {pages.filter(([id])=>(ids as readonly string[]).includes(id)).map(pageButton)}
  </section>)}</nav>

  return <>
    <aside className="sidebar">
      <div className="brand folio-brand"><FolioBrand/></div>
      {navigation}
      <div className="side-foot">
        <ThemeControl value={theme} onChange={setTheme}/>
        <div className="side-foot-meta">Investment Workspace <b>v0.1</b></div>
      </div>
    </aside>

    <div className="mobile-brandbar">
      <button className="mobile-brand-home" onClick={()=>setPage('today')} aria-label="오늘로 이동">
        <span className="folio-brand"><FolioBrand/></span>
      </button>
      <div className="mobile-brand-actions">
        <button className="mobile-brand-search" onClick={()=>setPage('analysis')} aria-label="종목 검색"><AppIcon name="search"/></button>
        <button className="mobile-brand-menu" onClick={()=>setOpen(true)} aria-label="전체 메뉴 열기" aria-haspopup="dialog" aria-expanded={open}><AppIcon name="menu"/></button>
      </div>
    </div>

    <nav className="mobile-bottom-nav" aria-label="모바일 빠른 메뉴">
      <button className={page==='today'?'active':''} onClick={()=>setPage('today')}><AppIcon name="home"/><b>오늘</b></button>
      <button className={['analysis','dashboard','signal','temperature','leaderboard','universe'].includes(page)?'active':''} onClick={()=>setPage('analysis')}><AppIcon name="search"/><b>발견</b></button>
      <button className={['notebook','thesis','research','journal'].includes(page)?'active':''} onClick={()=>setPage('notebook')}><AppIcon name="journal"/><b>저널</b></button>
      <button className={['tracking','watchlist','portfolio'].includes(page)?'active':''} onClick={()=>setPage('tracking')}><AppIcon name="watchlist"/><b>여정</b></button>
    </nav>

    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="menu-drawer">
        <div className="menu-drawer-head">
          <DialogTitle className="brand folio-brand"><FolioBrand/></DialogTitle>
          <DialogClose asChild><button className="menu-drawer-close" aria-label="메뉴 닫기"><AppIcon name="close"/></button></DialogClose>
        </div>
        <DialogDescription className="sr-only">페이지와 화면 테마를 선택하세요.</DialogDescription>
        {drawerNavigation}
        <div className="drawer-theme"><span>Appearance</span><ThemeControl value={theme} onChange={setTheme}/></div>
        <button className="drawer-refresh" type="button" onClick={()=>{onRefresh();setOpen(false)}} disabled={refreshing}>
          <AppIcon name="refresh"/><span>{refreshing?'새로고침 중':'데이터 새로고침'}</span>
        </button>
      </DialogContent>
    </Dialog>
  </>
}
