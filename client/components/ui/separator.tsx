import * as SeparatorPrimitive from '@radix-ui/react-separator';

export function Separator(
  props: React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
) {
  return <SeparatorPrimitive.Root className="h-px w-full bg-border" {...props} />;
}
