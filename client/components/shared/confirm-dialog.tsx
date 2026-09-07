'use client';

import { useState } from 'react';
import { Button } from '@/client/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/client/components/ui/dialog';

/**
 * Freno explicito antes de una accion con consecuencia real.
 *
 * Antes este componente no tenia boton de cancelar ni se cerraba solo: la
 * unica salida era la X. Ahora la salida sin consecuencia es la mas visible,
 * y el boton de accion nombra lo que va a pasar.
 */
export function ConfirmDialog({
  title,
  description,
  trigger,
  onConfirm,
  confirmLabel = 'Confirmar',
  cancelLabel = 'No, todavia no',
  variant = 'danger'
}: {
  title: string;
  description?: string;
  trigger: React.ReactNode;
  onConfirm: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary' | 'default';
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant}
            onClick={() => {
              setOpen(false);
              onConfirm();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
