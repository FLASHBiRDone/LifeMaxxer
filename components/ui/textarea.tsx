'use client';

import { cn } from '@/lib/cn';
import { type TextareaHTMLAttributes, forwardRef } from 'react';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'w-full rounded-xl border border-input bg-background px-3 py-2 text-sm',
        'placeholder:text-muted-foreground resize-none',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';
