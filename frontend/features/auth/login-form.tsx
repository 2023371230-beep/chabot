'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { IconCandado, IconCargando } from '@/components/icons';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/use-auth';

const schema = z.object({
  email: z.string().trim().email('Email invalido'),
  password: z.string().min(6, 'Minimo 6 caracteres')
});

type FormValues = z.infer<typeof schema>;

export function LoginForm() {
  const router = useRouter();
  const { signIn, configured } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      await signIn(values.email.trim().toLowerCase(), values.password);
      toast.success('Sesion iniciada');
      router.replace('/dashboard');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo iniciar sesion';
      toast.error(
        message.toLowerCase().includes('invalid')
          ? 'Credenciales incorrectas. Revisa email y password.'
          : message
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="mb-3 flex h-12 w-12 items-center justify-center bg-primary text-primary-foreground">
          <IconCandado className="h-5 w-5" />
        </div>
        <CardTitle className="text-2xl">Entrar al dashboard</CardTitle>
        <p className="text-sm text-muted-foreground">
          Usa tu cuenta de administrador configurada en Supabase Auth.
        </p>
      </CardHeader>
      <CardContent>
        {!configured ? (
          <div className="border border-warning/20 bg-warning/10 p-4 text-sm">
            Configura `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
            para habilitar el login.
          </div>
        ) : null}
        <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" placeholder="admin@empresa.com" {...register('email')} />
            {errors.email ? <p className="text-xs text-danger">{errors.email.message}</p> : null}
          </div>
          <div className="space-y-2">
            <Label>Password</Label>
            <Input type="password" placeholder="••••••••" {...register('password')} />
            {errors.password ? (
              <p className="text-xs text-danger">{errors.password.message}</p>
            ) : null}
          </div>
          <Button className="w-full" disabled={submitting || !configured}>
            {submitting ? <IconCargando className="h-4 w-4 animate-spin" /> : null}
            Iniciar sesion
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
