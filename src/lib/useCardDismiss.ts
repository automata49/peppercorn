import { useEffect, useRef } from 'react'
import { animate, useMotionValue, useReducedMotion } from 'motion/react'

/** Pull only from the top. Writing, ink, controls and ordinary upward scrolling keep their gestures. */
export function useCardDismiss(open: boolean, dismiss: () => void) {
 const ref = useRef<HTMLElement>(null), y = useMotionValue(0), reduce = useReducedMotion()
 const close = useRef(dismiss); close.current = dismiss
 useEffect(() => {
  const node = ref.current
  if (!open || !node) return
  y.set(0)
  let start: { x: number; y: number; at: number; id: number; type: 'touch' | 'mouse'; pulling: boolean } | null = null
  let suppressClick = false
  const eligible = (target: EventTarget | null) => {
   if (!(target instanceof Element) || node.scrollTop > 1) return false
   if (target.closest('.card-dismiss-handle')) return true
   if (target.closest('button,a,input,textarea,select,[contenteditable],[role="slider"],.ink-canvas')) return false
   for (let el: Element | null = target; el && el !== node; el = el.parentElement) {
    if (el instanceof HTMLElement && el.scrollHeight > el.clientHeight && el.scrollTop > 0) return false
   }
   return true
  }
  const begin = (x: number, top: number, id: number, type: 'touch' | 'mouse', target: EventTarget | null) => {
   suppressClick = false
   if (eligible(target)) start = { x, y: top, at: performance.now(), id, type, pulling: false }
  }
  const move = (x: number, top: number, event: Event) => {
   if (!start) return
   const dx = x - start.x, dy = top - start.y
   if (!start.pulling && (dy < -8 || Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy))) { start = null; return }
   if (dy > 8 && Math.abs(dy) > Math.abs(dx) * 1.2 && node.scrollTop <= 1) {
    start.pulling = true; suppressClick = true
    if (event.cancelable) event.preventDefault()
    y.set(Math.max(0, Math.min(dy * .8, node.clientHeight * .6)))
   }
  }
  const finish = (cancelled = false) => {
   if (!start) return
   const pulled = y.get(), elapsed = performance.now() - start.at
   const shouldClose = !cancelled && start.pulling && (pulled >= 80 || pulled >= 40 && elapsed < 250)
   start = null
   if (shouldClose) close.current()
   // Also returns to rest when the journal's unsaved-change confirmation is declined.
   animate(y, 0, { duration: reduce ? 0 : .22 })
  }
  const touchStart = (e: TouchEvent) => { if (e.touches.length !== 1) { finish(true); return }; const t = e.touches[0]; begin(t.clientX, t.clientY, t.identifier, 'touch', e.target) }
  const touchMove = (e: TouchEvent) => { if (e.touches.length !== 1) { finish(true); return }; const t = e.touches[0]; if (start?.type === 'touch' && t.identifier === start.id) move(t.clientX, t.clientY, e) }
  const touchEnd = () => finish()
  const cancel = () => finish(true)
  const pointerDown = (e: PointerEvent) => {
   if (e.pointerType !== 'mouse' || e.button !== 0 || !(e.target instanceof Element)) return
   if (e.target !== node && !e.target.closest('.card-dismiss-handle,.home-detail-cover,.story-detail-cover,.journal-dialog-header')) return
   if (eligible(e.target)) { e.preventDefault(); begin(e.clientX, e.clientY, e.pointerId, 'mouse', e.target) }
  }
  const pointerMove = (e: PointerEvent) => { if (start?.type === 'mouse' && start.id === e.pointerId) move(e.clientX, e.clientY, e) }
  const pointerUp = (e: PointerEvent) => { if (start?.type === 'mouse' && start.id === e.pointerId) finish() }
  const click = (e: MouseEvent) => {
   if (!suppressClick) return
   suppressClick = false
   // A cancelled pull must not swallow the next Save/edit click. Only the handle has a closing click action.
   if (e.target instanceof Element && e.target.closest('.card-dismiss-handle')) { e.preventDefault(); e.stopPropagation() }
  }
  node.addEventListener('touchstart', touchStart, { passive: true })
  node.addEventListener('touchmove', touchMove, { passive: false })
  node.addEventListener('touchend', touchEnd)
  node.addEventListener('touchcancel', cancel)
  node.addEventListener('pointerdown', pointerDown)
  window.addEventListener('pointermove', pointerMove)
  window.addEventListener('pointerup', pointerUp)
  window.addEventListener('pointercancel', cancel)
  node.addEventListener('click', click, true)
  return () => {
   node.removeEventListener('touchstart', touchStart); node.removeEventListener('touchmove', touchMove)
   node.removeEventListener('touchend', touchEnd); node.removeEventListener('touchcancel', cancel)
   node.removeEventListener('pointerdown', pointerDown); window.removeEventListener('pointermove', pointerMove)
   window.removeEventListener('pointerup', pointerUp); window.removeEventListener('pointercancel', cancel)
   node.removeEventListener('click', click, true)
   y.stop()
  }
 }, [open, y, reduce])
 return { ref, y }
}
