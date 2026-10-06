import fs from 'node:fs'
import zlib from 'node:zlib'

const baseline=fs.readFileSync('src/design/folio-baseline.css','utf8')
function brandHex(name){
  const m=baseline.match(new RegExp(name+':\\s*(#[0-9a-fA-F]{6})'))
  if(!m)throw new Error('Missing brand colour token: '+name)
  return m[1]
}
function rgb(hex){
  return [parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)]
}

const INK=[...rgb(brandHex('--folio-brand-icon-bg')),255]
const PLUM=rgb(brandHex('--folio-brand-plum'))
const MAGENTA=rgb(brandHex('--folio-brand-magenta'))
const CORAL=rgb(brandHex('--folio-brand-coral'))
const AMBER=rgb(brandHex('--folio-brand-amber'))
const VIEW_W=184
const VIEW_H=104
const MARK_WIDTH_RATIO=0.58
const MARK_ASPECT=VIEW_W/VIEW_H

const polygons=[
  [[0,0],[31,0],[99,104],[66,104]],
  [[66,0],[99,0],[31,104],[0,104]],
  [[85,0],[118,0],[184,104],[152,104]],
  [[151,0],[184,0],[118,104],[85,104]],
]
const diamond=[[92,33],[111,52],[92,71],[73,52]]

function insidePolygon(x,y,points){
  let inside=false
  for(let i=0,j=points.length-1;i<points.length;j=i++){
    const [xi,yi]=points[i],[xj,yj]=points[j]
    const hit=((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi||1e-9)+xi)
    if(hit)inside=!inside
  }
  return inside
}
function mix(a,b,t){return a.map((v,i)=>Math.round(v+(b[i]-v)*t))}
function colorAt(x){
  if(x<85){
    const t=Math.max(0,Math.min(1,x/99))
    return mix(PLUM,MAGENTA,t)
  }
  const t=Math.max(0,Math.min(1,(x-85)/(VIEW_W-85)))
  return t<.58?mix(MAGENTA,CORAL,t/.58):mix(CORAL,AMBER,(t-.58)/.42)
}
function coverage(px,py,w,h){
  let hit=0
  const n=4
  for(let sy=0;sy<n;sy++)for(let sx=0;sx<n;sx++){
    const x=((px+(sx+.5)/n)/w)*VIEW_W
    const y=((py+(sy+.5)/n)/h)*VIEW_H
    if(polygons.some(poly=>insidePolygon(x,y,poly))&&!insidePolygon(x,y,diamond))hit++
  }
  return hit/(n*n)
}
function compose(size){
  const markW=Math.round(size*MARK_WIDTH_RATIO)
  const markH=Math.round(markW/MARK_ASPECT)
  const pixels=Buffer.alloc(size*size*4)
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4
    pixels[i]=INK[0];pixels[i+1]=INK[1];pixels[i+2]=INK[2];pixels[i+3]=255
  }
  const ox=Math.round((size-markW)/2),oy=Math.round((size-markH)/2)
  for(let y=0;y<markH;y++)for(let x=0;x<markW;x++){
    const a=coverage(x,y,markW,markH)
    if(a<=0)continue
    const [r,g,b]=colorAt((x/Math.max(1,markW-1))*VIEW_W)
    const d=((y+oy)*size+(x+ox))*4
    const da=pixels[d+3]/255,outA=a+da*(1-a)
    pixels[d]=Math.round((r*a+pixels[d]*da*(1-a))/Math.max(outA,1e-8))
    pixels[d+1]=Math.round((g*a+pixels[d+1]*da*(1-a))/Math.max(outA,1e-8))
    pixels[d+2]=Math.round((b*a+pixels[d+2]*da*(1-a))/Math.max(outA,1e-8))
    pixels[d+3]=Math.round(outA*255)
  }
  return {w:size,h:size,pixels,markW,markH}
}
const crcTable=(()=>{const table=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;table[n]=c>>>0}return table})()
function crc32(buf){let c=0xffffffff;for(const b of buf)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0}
function chunk(type,data){const t=Buffer.from(type),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([t,data])));return Buffer.concat([len,t,data,crc])}
function encodePng(img){
  const stride=img.w*4,raw=Buffer.alloc((stride+1)*img.h)
  for(let y=0;y<img.h;y++){const o=y*(stride+1);raw[o]=0;img.pixels.copy(raw,o+1,y*stride,(y+1)*stride)}
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(img.w,0);ihdr.writeUInt32BE(img.h,4);ihdr[8]=8;ihdr[9]=6
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))])
}
for(const [size,file] of [
  [180,'public/folio-b-icon-180.png'],
  [192,'public/folio-b-icon-192.png'],
  [512,'public/folio-b-icon-512.png'],
  [512,'public/folio-b-icon-512-maskable.png'],
]){
  const img=compose(size)
  fs.writeFileSync(file,encodePng(img))
  console.log(`${file}: B diamond xx ${img.markW}×${img.markH} (${(img.markW/size*100).toFixed(1)}% width)`)
}
