import * as Primitive from '@radix-ui/react-tabs'
import { forwardRef, type ComponentPropsWithoutRef, type ComponentRef } from 'react'
import { cn } from '../../lib/cn'
export const Tabs=Primitive.Root
export const TabsList=forwardRef<ComponentRef<typeof Primitive.List>,ComponentPropsWithoutRef<typeof Primitive.List>>(({className,...props},ref)=><Primitive.List ref={ref} className={cn('folio-tabs-list',className)} {...props}/>)
export const TabsTrigger=forwardRef<ComponentRef<typeof Primitive.Trigger>,ComponentPropsWithoutRef<typeof Primitive.Trigger>>(({className,...props},ref)=><Primitive.Trigger ref={ref} className={cn('folio-tabs-trigger',className)} {...props}/>)
export const TabsContent=forwardRef<ComponentRef<typeof Primitive.Content>,ComponentPropsWithoutRef<typeof Primitive.Content>>(({className,...props},ref)=><Primitive.Content ref={ref} className={cn('folio-tabs-content',className)} {...props}/>)
