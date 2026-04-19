import { cn } from '@/lib/cn';

type Variant = 'default' | 'secondary' | 'success' | 'destructive';

const variants: Record<Variant, string> = {
  default: 'bg-primary/15 text-primary',
  secondary: 'bg-secondary text-secondary-foreground',
  success: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  destructive: 'bg-destructive/15 text-destructive',
};

export function Badge({
  variant = 'default',
  className,
  children,
}: {
  variant?: Variant;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
