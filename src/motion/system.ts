/** Interaction-only motion. GSAP remains responsible for the launch brand timeline. */
export const motionTokens={number:260,sheet:300,panel:220,ease:'cubic-bezier(.2,.8,.2,1)'} as const
export function prefersReducedMotion(){return typeof window==='undefined'||window.matchMedia('(prefers-reduced-motion: reduce)').matches}
export function animateSurface(element:HTMLElement,kind:'sheet'|'panel'){
  if(prefersReducedMotion())return ()=>{}
  const animation=element.animate([{opacity:0,transform:kind==='sheet'?'translateY(20px)':'translateX(20px)'},{opacity:1,transform:'translate(0,0)'}],{duration:motionTokens[kind],easing:motionTokens.ease})
  return ()=>animation.cancel()
}
