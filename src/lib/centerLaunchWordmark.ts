/**
 * Align visible wordmark ink, not the padded bitmap's bounding box.
 * Percent-based offsets follow the image when the viewport rotates/resizes.
 */
/**
 * iOS installed PWAs using an opaque native status bar start below the physical
 * top edge. A 100dvh fixed layer is centered in the *content* viewport, so its
 * logo lands about half the status-bar height below the phone's screen center.
 * Compensate only in iOS standalone mode; normal browser and desktop views
 * should keep their existing visual-viewport centering.
 */
export function launchPhysicalScreenShift(
  iosStandalone: boolean, safeTop: number, screenHeight: number, viewportHeight: number, screenWidth=0, viewportWidth=0,
): number {
  if (!iosStandalone) return 0
  // iOS can keep screen.height in portrait coordinates after rotating.
  const orientedHeight=screenWidth>0&&viewportWidth>viewportHeight?Math.min(screenHeight,screenWidth):screenHeight
  const excludedTop = Math.max(0, safeTop, orientedHeight - viewportHeight)
  if (excludedTop === 0) return 0
  return -Math.min(48, excludedTop / 2)
}

function readSafeAreaTop(): number {
  const probe=document.createElement('div')
  probe.style.cssText='position:fixed;pointer-events:none;visibility:hidden;padding-top:var(--folio-launch-safe-top,env(safe-area-inset-top,0px))'
  document.body.appendChild(probe)
  const inset=parseFloat(getComputedStyle(probe).paddingTop)||0
  probe.remove()
  return inset
}

function centerOnPhysicalScreen(image:HTMLImageElement):void {
  const device=/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)
  const installed=window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator&{standalone?:boolean}).standalone===true
  const safeTop=device&&installed?readSafeAreaTop():0
  const shift=launchPhysicalScreenShift(device&&installed,safeTop,window.screen.height,window.innerHeight,window.screen.width,window.innerWidth)
  image.style.setProperty('--launch-physical-y',shift.toFixed(2)+'px')
}

export function centerLaunchWordmark(image: HTMLImageElement): void {
  centerOnPhysicalScreen(image)
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
