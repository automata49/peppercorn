import type { ComponentProps, ReactNode } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'

export function Dialog(props:ComponentProps<typeof DialogPrimitive.Root>){
  return <DialogPrimitive.Root {...props}/>
}

export function DialogPortal({children}:{children:ReactNode}){
  return <DialogPrimitive.Portal>{children}</DialogPrimitive.Portal>
}

export function DialogOverlay({className='',...props}:ComponentProps<typeof DialogPrimitive.Overlay>){
  return <DialogPrimitive.Overlay className={'ui-dialog-overlay '+className} {...props}/>
}

export function DialogContent({className='',children,...props}:ComponentProps<typeof DialogPrimitive.Content>){
  return <DialogPortal><DialogOverlay/><DialogPrimitive.Content className={'ui-dialog-content '+className} {...props}>{children}</DialogPrimitive.Content></DialogPortal>
}

export function DialogTitle({className='',...props}:ComponentProps<typeof DialogPrimitive.Title>){
  return <DialogPrimitive.Title className={'ui-dialog-title '+className} {...props}/>
}

export function DialogDescription({className='',...props}:ComponentProps<typeof DialogPrimitive.Description>){
  return <DialogPrimitive.Description className={'ui-dialog-description '+className} {...props}/>
}

export function DialogClose(props:ComponentProps<typeof DialogPrimitive.Close>){
  return <DialogPrimitive.Close {...props}/>
}
