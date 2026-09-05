import { IconAlerta } from '@/components/icons';
import { Button } from '@/components/ui/button';

export function ErrorState({
  title,
  description,
  actionLabel = 'Reintentar',
  onRetry
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onRetry?: () => void | Promise<void>;
}) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-danger/30 bg-danger-soft p-4">
      <IconAlerta className="mt-0.5 shrink-0 text-danger" />
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-danger">{title}</h3>
        <p className="mt-1 max-w-xl text-xs text-muted-foreground">{description}</p>
        {onRetry ? (
          <Button className="mt-3" size="sm" variant="outline" onClick={() => void onRetry()}>
            {actionLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
