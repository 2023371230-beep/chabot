import { LoginForm } from '@/client/features/auth/login-form';

export const metadata = {
  title: 'Entrar — Bascula'
};

/**
 * Pantalla de acceso.
 *
 * Una sola tarjeta centrada, sin panel lateral ni texto de presentacion. La
 * primera version llevaba tres argumentos de venta al lado del formulario, y
 * era un error de premisa: quien entra aqui es el dueño de la distribuidora,
 * ya sabe que hace su propio sistema. Explicarselo lo convierte en un folleto.
 *
 * Lo premium sale del oficio — el material de la tarjeta, el ritmo tipografico
 * y como responde al tacto — no de agregar contenido.
 */
export default function LoginPage() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-5 py-10">
      {/* Fondo: una sola fuente de luz calida arriba, muy difusa, y una vineta
          que cierra los bordes. Fija, sin animar. Un fondo que se mueve solo
          compite con el campo que el usuario esta llenando, y ademas Apple
          desaconseja las oscilaciones lentas a pantalla completa. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 80% at 50% -10%, hsl(var(--primary) / 0.14), transparent 60%)'
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(100% 100% at 50% 50%, transparent 45%, hsl(var(--background) / 0.75) 100%)'
        }}
      />

      <LoginForm />
    </main>
  );
}
