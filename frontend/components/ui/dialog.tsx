'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { IconCerrar } from '@/components/icons';
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
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
      <DialogPrimitive.Content
        className={cn(
          [
            // Movil: hoja pegada abajo, mas facil de alcanzar con el pulgar.
            'fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] w-full overflow-y-auto',
            'rounded-t-lg border-t border-border bg-surface p-4 shadow-lg outline-none',
            // Escritorio: ventana flotante centrada.
            'sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[85dvh] sm:w-[calc(100%-3rem)] sm:max-w-lg',
            'sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:border sm:p-5'
          ].join(' '),
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-3 top-3 rounded-sm p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <IconCerrar className="h-4 w-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div className="mb-4 space-y-1 border-b border-rule pb-3 pr-8" {...props} />;
}

/**
 * Title y Description SI tienen que ser los primitivos de Radix: son los que
 * conectan aria-labelledby / aria-describedby con el dialogo. Un <h2> suelto
 * se ve igual pero deja el dialogo mudo para un lector de pantalla.
 */
export function DialogTitle({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn('text-md font-semibold leading-snug tracking-tight', className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn('text-sm leading-relaxed text-muted-foreground', className)}
      {...props}
    />
  );
}
