import { forwardRef, type ComponentProps, type ComponentRef } from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'

export const Popover = PopoverPrimitive.Root
export const PopoverTrigger = PopoverPrimitive.Trigger
export const PopoverClose = PopoverPrimitive.Close

export const PopoverContent = forwardRef<ComponentRef<typeof PopoverPrimitive.Content>, ComponentProps<typeof PopoverPrimitive.Content> & { overlay?: boolean; onOverlayClick?: () => void }>(
  ({ className = '', overlay = false, onOverlayClick, children, ...props }, ref) =>
    <PopoverPrimitive.Portal>
      {overlay && <div className="ui-popover-overlay" aria-hidden="true" onClick={onOverlayClick} />}
      <PopoverPrimitive.Content ref={ref} className={'ui-popover-content ' + className} {...props}>
        {children}
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
)
PopoverContent.displayName = 'PopoverContent'
