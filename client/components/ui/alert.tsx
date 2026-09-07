import { cn } from '@/client/lib/utils';

export function Alert({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('border border-warning/20 bg-warning/10 p-4 text-sm', className)}
      {...props}
    />
  );
}
