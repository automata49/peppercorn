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

// Folio brand lockup: the icon and wordmark share one height, as in the source artwork.
function FolioBrand(){
  return <><img className="brand-icon" src="./folio-icon.webp" alt=""/><img className="brand-wordmark-img" src="./folio-wordmark.webp" alt="Folio"/></>
}

export function Sidebar({page,setPage,open,setOpen}:{page:string;setPage:(p:string)=>void;open:boolean;setOpen:(open:boolean)=>void}){
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
      <div className="side-foot">Investment Workspace <b>v0.1</b></div>
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
        <DialogDescription className="sr-only">페이지를 선택하세요.</DialogDescription>
        {drawerNavigation}
      </DialogContent>
    </Dialog>
  </>
}
