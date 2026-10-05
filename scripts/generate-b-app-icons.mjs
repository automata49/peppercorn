import fs from 'node:fs'
import zlib from 'node:zlib'

const SOURCE='public/folio-b-xx-dark.png'
const INK=[11,11,13,255]
const MARK_WIDTH_RATIO=0.3125
const MARK_ASPECT=1.72
const ROUND_RADIUS_RATIO=0.18

function u32(buf,o){return buf.readUInt32BE(o)}
function paeth(a,b,c){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c}

function decodePng(file){
  const png=fs.readFileSync(file)
  const sig=Buffer.from([137,80,78,71,13,10,26,10])
  if(!png.subarray(0,8).equals(sig))throw new Error('PNG signature mismatch')
  let o=8,w=0,h=0,bit=0,type=0
  const idat=[]
  while(o<png.length){
    const len=u32(png,o);const name=png.toString('ascii',o+4,o+8);const data=png.subarray(o+8,o+8+len);o+=12+len
    if(name==='IHDR'){w=u32(data,0);h=u32(data,4);bit=data[8];type=data[9]}
    if(name==='IDAT')idat.push(data)
    if(name==='IEND')break
  }
  if(bit!==8||type!==6)throw new Error(`Expected 8-bit RGBA PNG, got bit=${bit} type=${type}`)
  const raw=zlib.inflateSync(Buffer.concat(idat)),bpp=4,stride=w*bpp
  const out=Buffer.alloc(w*h*bpp)
  let p=0
  for(let y=0;y<h;y++){
    const filter=raw[p++],row=out.subarray(y*stride,(y+1)*stride)
    for(let x=0;x<stride;x++){
      const val=raw[p++],a=x>=bpp?row[x-bpp]:0,b=y?out[(y-1)*stride+x]:0,c=y&&x>=bpp?out[(y-1)*stride+x-bpp]:0
      row[x]=(val+(filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):filter===4?paeth(a,b,c):(()=>{throw new Error('Unsupported PNG filter '+filter)})()))&255
    }
  }
  return {w,h,pixels:out}
}

function alphaCrop(img){
  let x0=img.w,y0=img.h,x1=-1,y1=-1
  for(let y=0;y<img.h;y++)for(let x=0;x<img.w;x++){
    const a=img.pixels[(y*img.w+x)*4+3]
    if(a>4){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}
  }
  if(x1<0)throw new Error('Empty mark source')
  const w=x1-x0+1,h=y1-y0+1,pixels=Buffer.alloc(w*h*4)
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const s=((y+y0)*img.w+(x+x0))*4,d=(y*w+x)*4
    img.pixels.copy(pixels,d,s,s+4)
  }
  return {w,h,pixels}
}

function sample(img,x,y){
  x=Math.max(0,Math.min(img.w-1,x));y=Math.max(0,Math.min(img.h-1,y))
  const x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(img.w-1,x0+1),y1=Math.min(img.h-1,y0+1)
  const fx=x-x0,fy=y-y0
  const out=[0,0,0,0]
  for(const [ix,wx] of [[x0,1-fx],[x1,fx]])for(const [iy,wy] of [[y0,1-fy],[y1,fy]]){
    const i=(iy*img.w+ix)*4,w=wx*wy
    for(let c=0;c<4;c++)out[c]+=img.pixels[i+c]*w
  }
  return out.map(v=>Math.round(v))
}

function resize(img,w,h){
  const pixels=Buffer.alloc(w*h*4)
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const sx=((x+.5)/w)*img.w-.5,sy=((y+.5)/h)*img.h-.5,rgba=sample(img,sx,sy),i=(y*w+x)*4
    for(let c=0;c<4;c++)pixels[i+c]=rgba[c]
  }
  return {w,h,pixels}
}

function roundedInside(x,y,size,r){
  if((x>=r&&x<size-r)||(y>=r&&y<size-r))return true
  const cx=x<r?r:size-r-1,cy=y<r?r:size-r-1
  return (x-cx)**2+(y-cy)**2<=r**2
}

function compose(size,{transparentCorners=false}={}){
  const source=alphaCrop(decodePng(SOURCE))
  const markW=Math.round(size*MARK_WIDTH_RATIO)
  const markH=Math.round(markW/MARK_ASPECT)
  const mark=resize(source,markW,markH)
  const pixels=Buffer.alloc(size*size*4)
  const radius=Math.round(size*ROUND_RADIUS_RATIO)
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4,inside=!transparentCorners||roundedInside(x,y,size,radius)
    if(inside){pixels[i]=INK[0];pixels[i+1]=INK[1];pixels[i+2]=INK[2];pixels[i+3]=255}
  }
  const ox=Math.round((size-markW)/2),oy=Math.round((size-markH)/2)
  for(let y=0;y<markH;y++)for(let x=0;x<markW;x++){
    const s=(y*markW+x)*4,d=((y+oy)*size+(x+ox))*4,a=mark.pixels[s+3]/255
    if(a<=0)continue
    const da=pixels[d+3]/255,outA=a+da*(1-a)
    for(let c=0;c<3;c++)pixels[d+c]=Math.round((mark.pixels[s+c]*a+pixels[d+c]*da*(1-a))/Math.max(outA,1e-8))
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
  console.log(`${file}: xx ${img.markW}×${img.markH} (${(img.markW/size*100).toFixed(1)}% × ${(img.markH/size*100).toFixed(1)}%)`)
}
