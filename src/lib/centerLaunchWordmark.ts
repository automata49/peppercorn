/**
 * Align visible wordmark ink, not the padded bitmap's bounding box.
 * Percent-based offsets follow the image when the viewport rotates/resizes.
 */
export function centerLaunchWordmark(image: HTMLImageElement): void {
  const width=image.naturalWidth,height=image.naturalHeight
  if(!width||!height)return
  try {
    const factor=Math.min(1,640/Math.max(width,height))
    const canvas=document.createElement('canvas')
    canvas.width=Math.max(1,Math.round(width*factor))
    canvas.height=Math.max(1,Math.round(height*factor))
    const ctx=canvas.getContext('2d',{willReadFrequently:true})
    if(!ctx)return
    ctx.drawImage(image,0,0,canvas.width,canvas.height)
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data
    let x0=canvas.width,y0=canvas.height,x1=-1,y1=-1
    for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
      const n=(y*canvas.width+x)*4
      const a=pixels[n+3]
      // Visible dark wordmark, including antialiased edges. Ignore white canvas.
      if(a>70&&Math.min(pixels[n],pixels[n+1],pixels[n+2])<185){
        if(x<x0)x0=x
        if(x>x1)x1=x
        if(y<y0)y0=y
        if(y>y1)y1=y
      }
    }
    if(x1<0||y1<0)return
    // Ignore a solid/dark photograph if the asset is changed in future.
    if((x1-x0+1)/canvas.width>.98&&(y1-y0+1)/canvas.height>.98)return
    image.style.setProperty('--launch-optical-x',((canvas.width-1-x0-x1)*50/canvas.width).toFixed(3)+'%')
    image.style.setProperty('--launch-optical-y',((canvas.height-1-y0-y1)*50/canvas.height).toFixed(3)+'%')
  } catch { /* Keep geometric centering if canvas is unsupported. */ }
}
