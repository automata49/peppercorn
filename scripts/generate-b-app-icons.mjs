import fs from 'node:fs'
import zlib from 'node:zlib'

const INK=[11,11,13,255]
const WARM=[244,241,236]
const PALE=[226,184,202]
const PALE=[246,236,232]
const PLUM=[84,38,95]
const MAGENTA=[163,79,120]
const CORAL=[240,106,69]
const AMBER=[245,162,74]
const MARK_WIDTH_RATIO=0.56
const MARK_ASPECT=1.84
const ROUND_RADIUS_RATIO=0.18
const VIEW_W=184
const VIEW_H=100

const polygons=[
  [[0,0],[32,0],[94,100],[62,100]],
  [[62,0],[94,0],[32,100],[0,100]],
  [[78,0],[110,0],[172,100],[140,100]],
  [[140,0],[172,0],[110,100],[78,100]],
]

function insidePolygon(x,y,points){
  let inside=false
  for(let i=0,j=points.length-1;i<points.length;j=i++){
    const xi=points[i][0],yi=points[i][1],xj=points[j][0],yj=points[j][1]
    const hit=((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi||1e-9)+xi)
    if(hit)inside=!inside
  }
  return inside
}
function mix(a,b,t){return a.map((v,i)=>Math.round(v+(b[i]-v)*t))}
function markColor(x){
  const t=Math.max(0,Math.min(1,x/VIEW_W))
  if(t<.24)return mix(WARM,PALE,t/.24)
  if(t<.44)return mix(PALE,PLUM,(t-.24)/.20)
  if(t<.66)return mix(PLUM,MAGENTA,(t-.44)/.22)
  if(t<.82)return mix(MAGENTA,CORAL,(t-.66)/.16)
  return mix(CORAL,AMBER,(t-.82)/.18)
}
function coverage(px,py,w,h){
  let hit=0
  const n=4
  for(let sy=0;sy<n;sy++)for(let sx=0;sx<n;sx++){
    const x=((px+(sx+.5)/n)/w)*VIEW_W
    const y=((py+(sy+.5)/n)/h)*VIEW_H
    if(polygons.some(poly=>insidePolygon(x,y,poly))&&!insidePolygon(x,y,cutDiamond))hit++
  }
  return hit/(n*n)
}
function roundedInside(x,y,size,r){
  if((x>=r&&x<size-r)||(y>=r&&y<size-r))return true
  const cx=x<r?r:size-r-1,cy=y<r?r:size-r-1
  return (x-cx)**2+(y-cy)**2<=r**2
}
function compose(size,{transparentCorners=false}={}){
  const markW=Math.round(size*MARK_WIDTH_RATIO)
  const markH=Math.round(markW/MARK_ASPECT)
  const pixels=Buffer.alloc(size*size*4)
  const radius=Math.round(size*ROUND_RADIUS_RATIO)
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4,inside=!transparentCorners||roundedInside(x,y,size,radius)
    if(inside){pixels[i]=INK[0];pixels[i+1]=INK[1];pixels[i+2]=INK[2];pixels[i+3]=255}
  }
  const ox=Math.round((size-markW)/2),oy=Math.round((size-markH)/2)
  for(let y=0;y<markH;y++)for(let x=0;x<markW;x++){
    const a=coverage(x,y,markW,markH)
    if(a<=0)continue
    const [r,g,b]=markColor((x/Math.max(1,markW-1))*VIEW_W)
    const d=((y+oy)*size+(x+ox))*4
    const da=pixels[d+3]/255,outA=a+da*(1-a)
    pixels[d]=Math.round((r*a+pixels[d]*da*(1-a))/Math.max(outA,1e-8))
    pixels[d+1]=Math.round((g*a+pixels[d+1]*da*(1-a))/Math.max(outA,1e-8))
    pixels[d+2]=Math.round((b*a+pixels[d+2]*da*(1-a))/Math.max(outA,1e-8))
    pixels[d+3]=Math.round(outA*255)
  }
  return {w:size,h:size,pixels,markW,markH}
}

const crcTable=(()=>{
  const table=new Uint32Array(256)
  for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;table[n]=c>>>0}
  return table
})()
function crc32(buf){let c=0xffffffff;for(const b of buf)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0}
function chunk(type,data){
  const t=Buffer.from(type),len=Buffer.alloc(4),crc=Buffer.alloc(4)
  len.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([t,data])))
  return Buffer.concat([len,t,data,crc])
}
function encodePng(img){
  const stride=img.w*4,raw=Buffer.alloc((stride+1)*img.h)
  for(let y=0;y<img.h;y++){const o=y*(stride+1);raw[o]=0;img.pixels.copy(raw,o+1,y*stride,(y+1)*stride)}
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(img.w,0);ihdr.writeUInt32BE(img.h,4);ihdr[8]=8;ihdr[9]=6
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))])
}

const outputs=[
  [180,'public/folio-b-icon-180.png',false],
  [192,'public/folio-b-icon-192.png',true],
  [512,'public/folio-b-icon-512.png',true],
  [512,'public/folio-b-icon-512-maskable.png',false],
]
for(const [size,file,transparentCorners] of outputs){
  const img=compose(size,{transparentCorners})
  fs.writeFileSync(file,encodePng(img))
  console.log(`${file}: procedural B xx ${img.markW}×${img.markH} (${(img.markW/size*100).toFixed(1)}% × ${(img.markH/size*100).toFixed(1)}%)`)
}
