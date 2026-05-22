import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  variant = 'default'
}: {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  variant?: 'default' | 'warning' | 'success' | 'info';
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <div className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
              {value}
            </div>
            {description ? (
              <p className="mt-2 text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          <div
            className={cn(
              'rounded-2xl p-3',
              variant === 'default' && 'bg-accent',
              variant === 'warning' && 'bg-warning/10 text-warning',
              variant === 'success' && 'bg-success/10 text-success',
              variant === 'info' && 'bg-info/10 text-info'
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
