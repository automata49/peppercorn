import { useEffect, useState } from 'react'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from './ui/dialog'
import { AppIcon, type AppIconName } from './AppIcon'

const pages:[string,AppIconName,string][]=[
  ['dashboard','home','Dashboard'],
  ['analysis','analysis','종목 분석'],
  ['temperature','temperature','시장 온도계'],
  ['watchlist','watchlist','Watchlist'],
  ['portfolio','portfolio','Portfolio'],
  ['journal','journal','Journal'],
  ['leaderboard','leaderboard','Leaderboard'],
  ['universe','universe','Universe'],
  ['settings','settings','Settings']
]
const pageGroups=[
  ['핵심',['dashboard','analysis','temperature','watchlist']],
  ['기록',['portfolio','journal']],
  ['전체 데이터',['leaderboard','universe','settings']]
] as const

type ThemeMode='system'|'light'|'dark'
const THEME_KEY='folio-theme'
const themeLabels:Record<ThemeMode,string>={system:'System',light:'Light',dark:'Dark'}

function readTheme():ThemeMode{
  try{
    const saved=window.localStorage.getItem(THEME_KEY)
    return saved==='light'||saved==='dark'||saved==='system'?saved:'system'
  }catch{
    return 'system'
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
    ?.setAttribute('content',resolved==='dark'?'#0a0a0c':'#f8f5f1')
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

// Folio brand lockup: the icon and wordmark share one height, as in the source artwork.
function FolioBrand(){
  return <><img className="brand-icon" src="./folio-icon.webp" alt=""/><img className="brand-wordmark-img" src="./folio-wordmark.webp" alt="Folio"/></>
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

  const goDashboardSection=(selector:string)=>{
    setPage('dashboard')
    setOpen(false)
    window.setTimeout(()=>document.querySelector(selector)?.scrollIntoView({behavior:'smooth',block:'start'}),80)
  }

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
      <button className="mobile-brand-home" onClick={()=>setPage('dashboard')} aria-label="Dashboard로 이동">
        <span className="folio-brand"><FolioBrand/></span>
      </button>
      <button className="mobile-brand-menu" onClick={()=>setOpen(true)} aria-label="전체 메뉴 열기" aria-haspopup="dialog" aria-expanded={open}><AppIcon name="menu"/></button>
    </div>

    <nav className="mobile-bottom-nav" aria-label="모바일 빠른 메뉴">
      <button className={page==='dashboard'?'active':''} onClick={()=>setPage('dashboard')}><AppIcon name="home"/><b>홈</b></button>
      <button onClick={()=>goDashboardSection('.dashboard-sector-panel')}><AppIcon name="sectors"/><b>섹터</b></button>
      <button className={page==='analysis'?'active':''} onClick={()=>setPage('analysis')}><AppIcon name="analysis"/><b>분석</b></button>
      <button className={page==='watchlist'?'active':''} onClick={()=>setPage('watchlist')}><AppIcon name="watchlist"/><b>관심</b></button>
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
