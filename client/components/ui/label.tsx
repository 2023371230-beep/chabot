import * as LabelPrimitive from '@radix-ui/react-label';
import { cn } from '@/client/lib/utils';

function Label({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn('text-sm font-medium leading-none text-foreground', className)}
      {...props}
    />
  );
}

export { Label };
