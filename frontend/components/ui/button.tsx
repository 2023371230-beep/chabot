'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  [
    'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap',
    'rounded-sm text-[13px] font-medium',
    'transition-[background-color,border-color,color,box-shadow] duration-150',
    'focus-visible:outline-none disabled:pointer-events-none disabled:opacity-45',
    'active:translate-y-px'
  ].join(' '),
  {
    variants: {
      variant: {
        default: 'bg-foreground text-background hover:opacity-90',
        primary:
          'bg-primary text-primary-foreground shadow-sm hover:brightness-110',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-accent',
        ghost: 'text-muted-foreground hover:bg-accent hover:text-foreground',
        outline:
          'border border-input bg-surface text-foreground shadow-sm hover:bg-accent',
        danger: 'bg-danger text-on-danger shadow-sm hover:brightness-110',
        'danger-soft':
          'border border-danger/25 bg-danger-soft text-danger hover:border-danger/50',
        'success-soft':
          'border border-success/25 bg-success-soft text-success hover:border-success/50'
      },
      size: {
        xs: 'h-6 px-2 text-xs',
        sm: 'h-7 px-2.5',
        md: 'h-8 px-3',
        lg: 'h-9 px-4 text-sm',
        icon: 'h-8 w-8 px-0'
      }
    },
    defaultVariants: { variant: 'default', size: 'md' }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
