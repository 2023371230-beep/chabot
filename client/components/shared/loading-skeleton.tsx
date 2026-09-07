import { Skeleton } from '@/client/components/ui/skeleton';

export function LoadingSkeleton() {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-28" />
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}
