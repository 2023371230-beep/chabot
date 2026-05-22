import { cn } from '@/lib/utils';

export function Alert({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-2xl border border-warning/20 bg-warning/10 p-4 text-sm', className)}
      {...props}
    />
  );
}
