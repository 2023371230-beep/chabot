import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Marca el campo como invalido: borde rojo + aria-invalid. */
  invalid?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        'flex h-9 w-full rounded-sm border bg-surface px-2.5 text-[13px] text-foreground shadow-sm outline-none transition-[border-color,box-shadow]',
        'placeholder:text-muted-foreground/70',
        'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20',
        'disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60',
        invalid ? 'border-danger focus-visible:ring-danger/20' : 'border-input',
        className
      )}
      {...props}
    />
  )
);
Input.displayName = 'Input';

/**
 * Campo con unidad pegada (por ejemplo `$` a la izquierda o `kg` a la derecha).
 * Poner la unidad DENTRO del campo evita que el usuario tenga que adivinar en
 * que unidad esta escribiendo, que es el error mas comun al capturar precios.
 */
export interface AffixInputProps extends InputProps {
  prefix?: string;
  suffix?: string;
}

const AffixInput = React.forwardRef<HTMLInputElement, AffixInputProps>(
  ({ prefix, suffix, className, invalid, ...props }, ref) => (
    <div className="relative">
      {prefix ? (
        <span className="num pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">
          {prefix}
        </span>
      ) : null}
      <Input
        ref={ref}
        invalid={invalid}
        className={cn('num', prefix && 'pl-6', suffix && 'pr-9', className)}
        {...props}
      />
      {suffix ? (
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          {suffix}
        </span>
      ) : null}
    </div>
  )
);
AffixInput.displayName = 'AffixInput';

export { Input, AffixInput };
