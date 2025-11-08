'use client';

import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/shared/utils/cn';

export interface FABProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'sm' | 'md' | 'lg';
}

const FAB = forwardRef<HTMLButtonElement, FABProps>(
  ({ className, size = 'md', children, ...props }, ref) => {
    const sizes = {
      sm: 'h-12 w-12',
      md: 'h-14 w-14',
      lg: 'h-16 w-16',
    };

    return (
      <button
        ref={ref}
        className={cn(
          'fixed z-50 rounded-full bg-primary text-primary-foreground shadow-lg',
          'hover:opacity-90 active:scale-95 transition-all',
          'flex items-center justify-center',
          'disabled:opacity-50 disabled:pointer-events-none',
          sizes[size],
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

FAB.displayName = 'FAB';

export default FAB;
