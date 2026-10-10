// shadcn/ui composition pattern, styled with the authoritative Folio tokens.
import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/cn'
export const buttonVariants=cva('folio-button',{
  variants:{variant:{default:'folio-button-primary',secondary:'folio-button-secondary',ghost:'folio-button-ghost'},size:{default:'',icon:'folio-button-icon'}},
  defaultVariants:{variant:'default',size:'default'}
})
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>,VariantProps<typeof buttonVariants>{asChild?:boolean}
export const Button=forwardRef<HTMLButtonElement,ButtonProps>(({className,variant,size,asChild=false,type='button',...props},ref)=>{
 const Comp=asChild?Slot:'button'
 return <Comp ref={ref} type={type} className={cn(buttonVariants({variant,size}),className)} {...props}/>
})
Button.displayName='Button'
