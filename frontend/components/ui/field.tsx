'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Campo de formulario completo: etiqueta, ayuda, control y error.
 *
 * Ata el `id` del control con el `for` de la etiqueta y con
 * `aria-describedby` de la ayuda y del error. Antes las etiquetas eran <Label>
 * sueltos sin `htmlFor`: se veian bien pero un lector de pantalla no sabia a
 * que campo pertenecian, y hacer clic en la etiqueta no enfocaba el control.
 *
 * `hint` se reserva para reglas de negocio que el usuario NO puede deducir
 * mirando el campo. Explicar lo obvio ("cuantos kilos tienes") es ruido: si
 * hace falta una frase para entender un control, el control esta mal hecho.
 */
export function Field({
  label,
  hint,
  error,
  required,
  className,
  children
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactElement;
}) {
  const id = React.useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  const control = React.cloneElement(children, {
    id,
    'aria-describedby': describedBy,
    invalid: Boolean(error) || undefined
  } as Record<string, unknown>);

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="flex items-center gap-1 text-xs font-medium">
        {label}
        {required ? (
          <span className="text-danger" aria-hidden>
            *
          </span>
        ) : null}
      </label>

      {control}

      {/* El error sustituye a la ayuda: dos textos bajo el campo compiten. */}
      {error ? (
        <p id={errorId} role="alert" className="text-2xs font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-2xs leading-snug text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Agrupa campos relacionados bajo un titulo. Reduce la carga cognitiva de un
 * formulario largo: el usuario procesa 3 grupos de 2 campos, no 6 campos.
 */
export function FieldGroup({
  title,
  description,
  className,
  children
}: {
  title?: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className={cn('flex flex-col gap-3', className)}>
      {title ? (
        <legend className="mb-0.5 flex flex-col gap-0.5">
          <span className="label">{title}</span>
          {description ? (
            <span className="text-2xs text-muted-foreground">{description}</span>
          ) : null}
        </legend>
      ) : null}
      {children}
    </fieldset>
  );
}

/**
 * Pie de formulario: separa visualmente la accion del contenido y mantiene el
 * boton primario siempre a la derecha, en el mismo lugar en todos los dialogos.
 */
export function FormFooter({
  children,
  note
}: {
  children: React.ReactNode;
  note?: string;
}) {
  return (
    <div className="-mx-4 -mb-4 mt-1 flex flex-col gap-2 border-t border-rule bg-surface-2/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      {note ? (
        <p className="text-2xs leading-snug text-muted-foreground sm:max-w-[55%]">{note}</p>
      ) : (
        <span />
      )}
      <div className="flex items-center justify-end gap-2">{children}</div>
    </div>
  );
}
