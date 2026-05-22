'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Send } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { endpoints } from '@/lib/api/endpoints';

const schema = z.object({
  telefono: z.string().min(5, 'Telefono requerido'),
  mensaje: z.string().min(1, 'Mensaje requerido')
});

type FormValues = z.infer<typeof schema>;

export function WhatsappTestForm() {
  const [submitting, setSubmitting] = useState(false);
  const [response, setResponse] = useState<unknown>(null);
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      telefono: '4421234567',
      mensaje: 'Quiero 20 kg de pechuga para manana'
    }
  });

  const submit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const result = await endpoints.whatsapp.webhook(values);
      setResponse(result);
      toast.success('Webhook probado');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo probar');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="grid gap-4">
      <div className="space-y-2">
        <Label>Telefono</Label>
        <Input {...register('telefono')} />
        {errors.telefono ? <p className="text-xs text-danger">{errors.telefono.message}</p> : null}
      </div>
      <div className="space-y-2">
        <Label>Mensaje</Label>
        <Textarea {...register('mensaje')} />
        {errors.mensaje ? <p className="text-xs text-danger">{errors.mensaje.message}</p> : null}
      </div>
      <Button disabled={submitting} className="justify-self-end">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Enviar prueba
      </Button>
      {response ? (
        <pre className="max-h-72 overflow-auto rounded-2xl bg-muted p-4 text-xs">
          {JSON.stringify(response, null, 2)}
        </pre>
      ) : null}
    </form>
  );
}
