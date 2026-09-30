// Squarified treemap (Bruls, Huizing & van Wijk): lays items with positive values into a w×h rectangle,
// keeping tiles as close to square as possible. Items are placed largest first; zero/negative values are skipped.
export type TreemapRect<T>={item:T;x:number;y:number;w:number;h:number}

export function squarify<T>(items:T[],value:(item:T)=>number,w:number,h:number):TreemapRect<T>[]{
  const nodes=items.map(item=>({item,v:value(item)})).filter(n=>Number.isFinite(n.v)&&n.v>0).sort((a,b)=>b.v-a.v)
  const total=nodes.reduce((s,n)=>s+n.v,0)
  if(!total||w<=0||h<=0)return []
  const scale=w*h/total
  const areas=nodes.map(n=>({item:n.item,a:n.v*scale}))
  const out:TreemapRect<T>[]=[]
  let x=0,y=0,rw=w,rh=h,row:typeof areas=[]
  const worst=(r:typeof areas,side:number)=>{
    const s=r.reduce((t,n)=>t+n.a,0),mx=Math.max(...r.map(n=>n.a)),mn=Math.min(...r.map(n=>n.a))
    return Math.max(side*side*mx/(s*s),(s*s)/(side*side*mn))
  }
  const layout=(r:typeof areas)=>{
    const s=r.reduce((t,n)=>t+n.a,0)
    if(rw>=rh){ // column along the left edge
      const cw=s/rh;let cy=y
      for(const n of r){const nh=n.a/cw;out.push({item:n.item,x,y:cy,w:cw,h:nh});cy+=nh}
      x+=cw;rw-=cw
    }else{ // row along the top edge
      const ch=s/rw;let cx=x
      for(const n of r){const nw=n.a/ch;out.push({item:n.item,x:cx,y,w:nw,h:ch});cx+=nw}
      y+=ch;rh-=ch
    }
  }
  for(const n of areas){
    const side=Math.min(rw,rh)
    if(!row.length||worst([...row,n],side)<=worst(row,side))row.push(n)
    else{layout(row);row=[n]}
  }
  if(row.length)layout(row)
  return out
}
