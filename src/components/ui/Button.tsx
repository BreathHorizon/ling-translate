import React from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50',
          {
            'bg-primary text-white hover:bg-primary-dark shadow-sm': variant === 'primary',
            'bg-secondary text-white hover:bg-secondary-dark shadow-sm': variant === 'secondary',
            'border border-gray-200 bg-white hover:bg-gray-100 text-gray-900': variant === 'outline',
            'hover:bg-gray-100 text-gray-700': variant === 'ghost',
            'bg-red-500 text-white hover:bg-red-600': variant === 'destructive',
            'h-8 px-3 text-xs': size === 'sm',
            'h-10 px-4 py-2': size === 'md',
            'h-12 px-6 text-lg': size === 'lg',
            'h-10 w-10 p-0': size === 'icon',
          },
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
