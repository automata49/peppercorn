import { forwardRef, type ComponentProps, type ComponentRef, type ReactNode } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'

export function Dialog(props:ComponentProps<typeof DialogPrimitive.Root>){
  return <DialogPrimitive.Root {...props}/>
}

export function DialogPortal({children}:{children:ReactNode}){
  return <DialogPrimitive.Portal>{children}</DialogPrimitive.Portal>
}

export const DialogOverlay=forwardRef<ComponentRef<typeof DialogPrimitive.Overlay>,ComponentProps<typeof DialogPrimitive.Overlay>>(
  ({className='',...props},ref)=><DialogPrimitive.Overlay ref={ref} className={'ui-dialog-overlay '+className} {...props}/>
)

export const DialogContent=forwardRef<ComponentRef<typeof DialogPrimitive.Content>,ComponentProps<typeof DialogPrimitive.Content>>(
  ({className='',children,...props},ref)=><DialogPortal><DialogOverlay/><DialogPrimitive.Content ref={ref} className={'ui-dialog-content '+className} {...props}>{children}</DialogPrimitive.Content></DialogPortal>
)

export function DialogTitle({className='',...props}:ComponentProps<typeof DialogPrimitive.Title>){
  return <DialogPrimitive.Title className={'ui-dialog-title '+className} {...props}/>
}

export function DialogDescription({className='',...props}:ComponentProps<typeof DialogPrimitive.Description>){
  return <DialogPrimitive.Description className={'ui-dialog-description '+className} {...props}/>
}

export function DialogClose(props:ComponentProps<typeof DialogPrimitive.Close>){
  return <DialogPrimitive.Close {...props}/>
}
