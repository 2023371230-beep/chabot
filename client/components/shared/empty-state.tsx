import type { ComponentType, SVGProps } from 'react';

export type EmptyIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;

export function EmptyState({
  icon: Icon,
  title,
  description,
  action
}: {
  icon?: EmptyIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-12 text-center">
      {Icon ? (
        <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon size={20} />
        </span>
      ) : null}
      <h3 className="text-sm font-semibold">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
