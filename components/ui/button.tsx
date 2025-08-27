'use client'

import * as React from 'react'
import { cn } from '../../lib/utils'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'pink' | 'destructive' | 'gradient'
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'rounded-[16px] px-6 py-3 font-medium text-text transition-transform duration-150 ease-out shadow-sm',
          'hover:shadow-hover hover:-translate-y-[2px]',
          {
            primary: 'bg-brand-blue',
            pink: 'bg-brand-pink',
            gradient: 'bg-gradient-to-r from-brand-blue to-brand-pink',
            destructive: 'bg-[#E74C3C] text-white hover:bg-[#c0392b]'
          }[variant],
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'
