import { useState } from 'react'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from './ui/dialog'

const pages=[
  ['dashboard','◫','Dashboard'],
  ['leaderboard','↗','Leaderboard'],
  ['analysis','▦','종목 분석'],
  ['research','⌕','Research'],
  ['watchlist','◎','Watchlist'],
  ['portfolio','◆','Portfolio'],
  ['journal','✎','Journal'],
  ['universe','⊙','Universe'],
  ['settings','⚙','Settings']
]

export function Sidebar({page,setPage}:{page:string;setPage:(p:string)=>void}){
  const [open,setOpen]=useState(false)
  const navigation=<nav aria-label="주 메뉴">{pages.map(([id,mark,label])=>
      <button key={id} className={page===id?'active':''} onClick={()=>{setPage(id);setOpen(false)}} aria-current={page===id?'page':undefined}>
        <span className="nav-icon" aria-hidden="true">{mark}</span><span className="nav-label">{label}</span>
      </button>
    )}</nav>

  const goDashboardSection=(selector:string)=>{
    setPage('dashboard')
    setOpen(false)
    window.setTimeout(()=>document.querySelector(selector)?.scrollIntoView({behavior:'smooth',block:'start'}),80)
  }

  return <>
    <aside className="sidebar">
      <div className="brand"><img src="./logo.webp" alt=""/><div><strong>Peppercorn</strong><span>Capital</span></div></div>
      {navigation}
      <div className="side-foot">Investment Workspace <b>v0.1</b></div>
    </aside>

    <div className="mobile-brandbar">
      <button className="mobile-brand-home" onClick={()=>setPage('dashboard')} aria-label="Dashboard로 이동">
        <img src="./logo.webp" alt=""/><strong>Peppercorn Capital</strong>
      </button>
      <button className="mobile-brand-menu" onClick={()=>setOpen(true)} aria-label="전체 메뉴 열기" aria-haspopup="dialog" aria-expanded={open}>☰</button>
    </div>

    <button className="menu-trigger" onClick={()=>setOpen(true)} aria-label="메뉴 열기" aria-haspopup="dialog" aria-expanded={open}>
      <span aria-hidden="true">☰</span><span className="menu-trigger-label">메뉴</span>
    </button>

    <nav className="mobile-bottom-nav" aria-label="모바일 빠른 메뉴">
      <button className={page==='dashboard'?'active':''} onClick={()=>setPage('dashboard')}><span aria-hidden="true">⌂</span><b>Dashboard</b></button>
      <button onClick={()=>goDashboardSection('.dashboard-sector-panel')}><span aria-hidden="true">▥</span><b>섹터</b></button>
      <button className={page==='analysis'?'active':''} onClick={()=>setPage('analysis')}><span aria-hidden="true">▤</span><b>종목</b></button>
      <button className={page==='watchlist'?'active':''} onClick={()=>setPage('watchlist')}><span aria-hidden="true">★</span><b>관심목록</b></button>
    </nav>

    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="menu-drawer">
        <div className="menu-drawer-head">
          <div className="brand"><img src="./logo.webp" alt=""/><div><DialogTitle>Peppercorn</DialogTitle><span>Capital</span></div></div>
          <DialogClose asChild><button className="menu-drawer-close" aria-label="메뉴 닫기">×</button></DialogClose>
        </div>
        <DialogDescription className="sr-only">페이지를 선택하세요.</DialogDescription>
        {navigation}
      </DialogContent>
    </Dialog>
  </>
}
