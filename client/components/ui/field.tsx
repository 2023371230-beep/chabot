'use client';

import * as React from 'react';
import { cn } from '@/client/lib/utils';

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
 *
 * `adorno` recibe un elemento que se posiciona sobre el borde derecho del
 * control (el ojo de "ver contraseña", por ejemplo). Existe como prop en vez
 * de dejar que cada formulario envuelva el control en su propio <div>: al
 * envolverlo, el `cloneElement` de abajo le pondria el `id` y el `invalid` al
 * <div> en vez de al input, y la etiqueta dejaria de enfocar el campo al hacer
 * clic — un fallo que no se ve pero rompe la accesibilidad.
 */
export function Field({
  label,
  hint,
  error,
  required,
  className,
  adorno,
  children
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  adorno?: React.ReactNode;
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

      {adorno ? (
        <div className="relative">
          {control}
          <div className="absolute right-1 top-1/2 -translate-y-1/2">{adorno}</div>
        </div>
      ) : (
        control
      )}

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
 *
 * Va PEGADO ABAJO (`sticky`) por un motivo medido, no estetico: los dialogos
 * se limitan a 85dvh y el contenido desborda. En una pantalla de 1366x768 —
 * la resolucion de portatil mas comun — el boton "Crear pedido" quedaba en
 * y=842 con la ventana midiendo 768: fuera de la vista, alcanzable solo si al
 * usuario se le ocurria hacer scroll DENTRO del dialogo. Un formulario cuyo
 * boton de guardar no se ve es un formulario que no se puede enviar.
 *
 * Con `sticky bottom-0` la accion esta siempre a la vista y el que se mueve es
 * el contenido, que es lo que se espera. `bg-surface` opaco (no translucido)
 * para que el texto que pasa por debajo no se lea a traves.
 */
export function FormFooter({
  children,
  note
}: {
  children: React.ReactNode;
  note?: string;
}) {
  return (
    // El `bottom` negativo iguala al padding del dialogo (p-4, y p-5 en
    // escritorio). `sticky bottom-0` se ancla al borde INTERIOR del contenedor
    // con scroll, no al visible: dejaba una franja de 21px por la que se
    // asomaba el contenido al scrollear, y la ventana parecia rota.
    <div className="sticky -bottom-4 z-10 -mx-4 -mb-4 mt-1 flex flex-col gap-2 border-t border-rule bg-surface px-4 py-3 sm:-bottom-5 sm:-mx-5 sm:-mb-5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      {note ? (
        <p className="text-xs leading-snug text-muted-foreground sm:max-w-[55%]">{note}</p>
      ) : (
        <span />
      )}
      <div className="flex shrink-0 items-center justify-end gap-2">{children}</div>
    </div>
  );
}
