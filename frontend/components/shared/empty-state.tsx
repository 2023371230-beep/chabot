import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function EmptyState({
  icon: Icon,
  title,
  description,
  action
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center p-10 text-center">
        <div className="mb-4 rounded-2xl bg-accent p-4">
          <Icon className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-semibold">{title}</h3>
        {description ? (
          <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
        ) : null}
        {action ? <div className="mt-5">{action}</div> : null}
      </CardContent>
    </Card>
  );
}
