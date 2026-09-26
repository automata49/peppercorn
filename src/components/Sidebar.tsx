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
  return <aside className="sidebar">
    <div className="brand"><img src="./logo.webp" alt=""/><div><strong>Peppercorn</strong><span>Capital</span></div></div>
    <nav>{pages.map(([id,mark,label])=>
      <button key={id} className={page===id?'active':''} onClick={()=>setPage(id)} aria-label={label} aria-current={page===id?'page':undefined} title={label}>
        <span className="nav-icon" aria-hidden="true">{mark}</span><span className="nav-label">{label}</span>
      </button>
    )}</nav>
    <div className="side-foot">Investment Workspace <b>v0.1</b></div>
  </aside>
}
