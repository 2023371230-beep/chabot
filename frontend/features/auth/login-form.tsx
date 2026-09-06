'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { motion, useAnimationControls, useReducedMotion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { IconBascula, IconCargando, IconVer } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';

const schema = z.object({
  email: z.string().trim().min(1, 'Falta el correo').email('Ese correo no se ve bien'),
  password: z.string().min(1, 'Falta la contraseña')
});

type FormValues = z.infer<typeof schema>;

/**
 * Muelle base de la pantalla.
 *
 * Criticamente amortiguado (`bounce: 0`): entra rapido y aterriza sin rebotar.
 * El rebote se reserva para lo que el usuario empuja con el dedo — una tarjeta
 * que aparece sola y sobrepasa su posicion se siente decorativa, no fisica.
 */
const MUELLE = { type: 'spring', bounce: 0, duration: 0.45 } as const;

/**
 * Formulario de acceso.
 *
 * Tres decisiones que no son esteticas:
 *
 * La contraseña solo se valida como "no vacia". Exigir "minimo 6 caracteres"
 * en un LOGIN aplica una regla de creacion de cuentas a una contraseña que ya
 * existe: si el usuario se equivoca, lo correcto es decir que las credenciales
 * no coinciden, no darle una clase de politica de contraseñas.
 *
 * El error jamas dice cual de los dos campos fallo. Distinguir "ese correo no
 * existe" de "la contraseña no coincide" le confirma a un atacante que correos
 * estan registrados, que es el primer paso de un ataque dirigido.
 *
 * El temblor del error se dispara con `useAnimationControls` y no con estado.
 * Con estado, dos fallos seguidos con el mismo valor no vuelven a animar —
 * React no re-renderiza si nada cambio — y el segundo intento fallido se
 * quedaba mudo justo cuando mas hace falta la señal.
 */
export function LoginForm() {
  const router = useRouter();
  const { signIn, configured } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [verPassword, setVerPassword] = useState(false);
  const quieto = useReducedMotion();
  const temblor = useAnimationControls();

  useEffect(() => {
    void temblor.start({ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' });
  }, [temblor]);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      await signIn(values.email.trim().toLowerCase(), values.password);
      router.replace('/dashboard');
    } catch (error) {
      // La señal visual llega antes que el toast y no depende de que el usuario
      // este mirando la esquina superior derecha.
      if (!quieto) {
        void temblor.start({
          x: [0, -8, 7, -4, 0],
          transition: { duration: 0.36, ease: [0.22, 1, 0.36, 1] }
        });
      }
      const message = error instanceof Error ? error.message : '';
      toast.error(
        message.toLowerCase().includes('invalid') || !message
          ? 'Correo o contraseña incorrectos'
          : message
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Con movimiento reducido no se desplaza nada: solo aparece. La preferencia
  // pide evitar el movimiento, no el cambio de estado.
  const entrada = (delay: number) =>
    quieto
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.2, delay } }
      : {
          initial: { opacity: 0, y: 10 },
          animate: { opacity: 1, y: 0 },
          transition: { ...MUELLE, delay }
        };

  return (
    <motion.div
      // `animate` recibe los controles: la entrada se dispara con `.start()` al
      // montar y los mismos controles llevan despues el temblor del error. Con
      // `whileInView` la tarjeta dependeria del observador de scroll para algo
      // que ya esta a la vista al cargar.
      animate={temblor}
      className="relative w-full max-w-[26rem]"
      // El filtro se anima junto a la escala para que la tarjeta se materialice
      // como una superficie que llega, no como una imagen que sube de opacidad.
      initial={quieto ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.985, filter: 'blur(6px)' }}
      transition={MUELLE}
    >
      <div className="rounded-xl border border-border/70 bg-surface/80 p-7 shadow-lg backdrop-blur-xl sm:p-8">
        {/* Filo superior claro: es como la luz toca el canto de un material real
            y lo que separa una tarjeta de un rectangulo con borde. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-foreground/20 to-transparent"
        />

        <motion.div {...entrada(0.04)} className="flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <IconBascula className="h-6 w-6" />
          </span>
          {/* Tracking negativo porque el tamaño es grande: a 24px las letras se
              leen demasiado separadas con el espaciado por defecto. */}
          <h1 className="mt-4 text-xl font-semibold tracking-[-0.02em]">Bascula</h1>
        </motion.div>

        {!configured ? (
          <motion.p
            {...entrada(0.08)}
            className="mt-6 rounded-md border border-warning/25 bg-warning/10 p-3 text-xs leading-relaxed"
          >
            Faltan las variables de Supabase en el entorno.
          </motion.p>
        ) : null}

        <motion.form {...entrada(0.1)} onSubmit={handleSubmit(onSubmit)} className="mt-7">
          <FieldGroup>
            <Field label="Correo" error={errors.email?.message}>
              <Input
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="tu@correo.com"
                {...register('email')}
              />
            </Field>

            <Field
              label="Contraseña"
              error={errors.password?.message}
              adorno={
                <button
                  type="button"
                  onClick={() => setVerPassword((v) => !v)}
                  aria-label={verPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  className="flex h-8 w-8 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground active:scale-95"
                >
                  <IconVer className={verPassword ? 'text-primary' : undefined} />
                </button>
              }
            >
              <Input
                type={verPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                className="pr-11"
                {...register('password')}
              />
            </Field>
          </FieldGroup>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="mt-7 w-full"
            disabled={submitting || !configured}
          >
            {submitting ? <IconCargando className="h-4 w-4 animate-spin" /> : null}
            {submitting ? 'Entrando' : 'Entrar'}
          </Button>
        </motion.form>
      </div>
    </motion.div>
  );
}
