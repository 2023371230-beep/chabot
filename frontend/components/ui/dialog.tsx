'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out" />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 grid max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-3xl border border-border bg-card p-6 shadow-soft outline-none data-[state=open]:animate-in data-[state=closed]:animate-out',
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-full p-2 opacity-70 transition-opacity hover:bg-muted hover:opacity-100">
          <X className="h-4 w-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div className="space-y-1.5 pr-8" {...props} />;
}

export function DialogTitle(props: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className="text-xl font-semibold tracking-tight" {...props} />;
}

export function DialogDescription(props: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className="text-sm text-muted-foreground" {...props} />;
}
