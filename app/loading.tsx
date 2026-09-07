import { LoadingSkeleton } from '@/client/components/shared/loading-skeleton';

export default function Loading() {
  return (
    <div className="page-shell">
      <LoadingSkeleton />
    </div>
  );
}
