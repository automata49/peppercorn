import type { ComponentProps, ReactNode } from 'react'
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog'

export function AlertDialog(props:ComponentProps<typeof AlertDialogPrimitive.Root>){
  return <AlertDialogPrimitive.Root {...props}/>
}
export function AlertDialogPortal({children}:{children:ReactNode}){return <AlertDialogPrimitive.Portal>{children}</AlertDialogPrimitive.Portal>}
export function AlertDialogOverlay({className='',...props}:ComponentProps<typeof AlertDialogPrimitive.Overlay>){
  return <AlertDialogPrimitive.Overlay className={'ui-dialog-overlay '+className} {...props}/>
}
export function AlertDialogContent({className='',children,...props}:ComponentProps<typeof AlertDialogPrimitive.Content>){
  return <AlertDialogPortal><AlertDialogOverlay/><AlertDialogPrimitive.Content className={'ui-alert-content '+className} {...props}>{children}</AlertDialogPrimitive.Content></AlertDialogPortal>
}
export function AlertDialogTitle({className='',...props}:ComponentProps<typeof AlertDialogPrimitive.Title>){return <AlertDialogPrimitive.Title className={'ui-alert-title '+className} {...props}/>}
export function AlertDialogDescription({className='',...props}:ComponentProps<typeof AlertDialogPrimitive.Description>){return <AlertDialogPrimitive.Description className={'ui-alert-description '+className} {...props}/>}
export function AlertDialogCancel({className='',...props}:ComponentProps<typeof AlertDialogPrimitive.Cancel>){return <AlertDialogPrimitive.Cancel className={'ui-alert-cancel '+className} {...props}/>}
export function AlertDialogAction({className='',...props}:ComponentProps<typeof AlertDialogPrimitive.Action>){return <AlertDialogPrimitive.Action className={'ui-alert-action '+className} {...props}/>}
