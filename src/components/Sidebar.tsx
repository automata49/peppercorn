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

  return <>
    <aside className="sidebar">
      <div className="brand"><img src="./logo.webp" alt=""/><div><strong>Peppercorn</strong><span>Capital</span></div></div>
      {navigation}
      <div className="side-foot">Investment Workspace <b>v0.1</b></div>
    </aside>
    <button className="menu-trigger" onClick={()=>setOpen(true)} aria-label="메뉴 열기" aria-haspopup="dialog" aria-expanded={open}>
      <span aria-hidden="true">☰</span><span className="menu-trigger-label">메뉴</span>
    </button>
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
