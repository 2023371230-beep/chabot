import { cn } from '@/client/lib/utils';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse bg-muted', className)} {...props} />;
}
