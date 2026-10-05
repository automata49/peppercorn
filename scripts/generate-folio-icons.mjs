import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const OUT=path.resolve('public')
const stops=[
  [0,[84,38,95]],
  [.35,[163,79,120]],
  [.68,[240,106,69]],
  [1,[245,162,74]],
]

function mix(a,b,t){return a.map((v,i)=>Math.round(v*(1-t)+b[i]*t))}
function gradient(t){
  t=Math.max(0,Math.min(1,t))
  for(let i=0;i<stops.length-1;i++){
    const [a,ca]=stops[i],[b,cb]=stops[i+1]
    if(t>=a&&t<=b)return mix(ca,cb,(t-a)/(b-a))
  }
  return stops.at(-1)[1]
}

const crcTable=(()=>{
  const table=new Uint32Array(256)
  for(let n=0;n<256;n++){
    let c=n
    for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1
    table[n]=c>>>0
  }
  return table
})()

function crc32(buf){
  let c=0xffffffff
  for(const b of buf)c=crcTable[(c^b)&0xff]^(c>>>8)
  return (c^0xffffffff)>>>0
}
function chunk(type,data){
  const t=Buffer.from(type)
  const len=Buffer.alloc(4);len.writeUInt32BE(data.length)
  const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(Buffer.concat([t,data])))
  return Buffer.concat([len,t,data,crc])
}
function png(width,height,rgba){
  const raw=Buffer.alloc((width*4+1)*height)
  for(let y=0;y<height;y++){
    const row=y*(width*4+1);raw[row]=0
    rgba.copy(raw,row+1,y*width*4,(y+1)*width*4)
  }
  const ihdr=Buffer.alloc(13)
  ihdr.writeUInt32BE(width,0);ihdr.writeUInt32BE(height,4)
  ihdr[8]=8;ihdr[9]=6;ihdr[10]=0;ihdr[11]=0;ihdr[12]=0
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    chunk('IHDR',ihdr),
    chunk('IDAT',zlib.deflateSync(raw,{level:9})),
    chunk('IEND',Buffer.alloc(0)),
  ])
}

function segmentDistance(px,py,x1,y1,x2,y2){
  const vx=x2-x1,vy=y2-y1,wx=px-x1,wy=py-y1
  const c1=wx*vx+wy*vy,c2=vx*vx+vy*vy
  const t=Math.max(0,Math.min(1,c1/c2))
  const dx=px-(x1+t*vx),dy=py-(y1+t*vy)
  return Math.hypot(dx,dy)
}
function coverage(d,half){
  const feather=1.35
  if(d<=half-feather)return 1
  if(d>=half+feather)return 0
  return (half+feather-d)/(feather*2)
}

function makeIcon(size,file){
  const buf=Buffer.alloc(size*size*4)
  const bg=[11,11,13]
  const top=size*.28,bot=size*.72,halfW=size*.105,stroke=size*.085
  const centers=[size*.42,size*.62]
  for(let y=0;y<size;y++){
    for(let x=0;x<size;x++){
      const i=(y*size+x)*4
      const dx=(x-size*.5)/(size*.72),dy=(y-size*.47)/(size*.72)
      const r=Math.hypot(dx,dy)
      const glow=Math.max(0,1-r)**2*.12
      const gc=gradient(x/(size-1))
      let rgb=bg.map((v,j)=>Math.round(v*(1-glow)+gc[j]*glow))
      let a=0
      for(const c of centers){
        const d1=segmentDistance(x,y,c-halfW,top,c+halfW,bot)
        const d2=segmentDistance(x,y,c+halfW,top,c-halfW,bot)
        a=Math.max(a,coverage(Math.min(d1,d2),stroke/2))
      }
      if(a>0){
        const fg=gradient(x/(size-1))
        rgb=rgb.map((v,j)=>Math.round(v*(1-a)+fg[j]*a))
      }
      buf[i]=rgb[0];buf[i+1]=rgb[1];buf[i+2]=rgb[2];buf[i+3]=255
    }
  }
  fs.writeFileSync(path.join(OUT,file),png(size,size,buf))
}

fs.mkdirSync(OUT,{recursive:true})
makeIcon(180,'folio-identity-180.png')
makeIcon(192,'folio-identity-192.png')
makeIcon(512,'folio-identity-512.png')
makeIcon(512,'folio-identity-512-maskable.png')
console.log('Generated Folio identity icons')
