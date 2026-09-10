'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { IconMenu, IconSalir, IconTema } from '@/client/components/icons';
import { Button } from '@/client/components/ui/button';
import { endpoints } from '@/client/lib/api/endpoints';
import { navItems } from '@/client/lib/constants';
import { cn } from '@/client/lib/utils';
import { useAuth } from '@/client/hooks/use-auth';
import { useHandoffs } from '@/client/features/whatsapp/handoffs-provider';
import { MobileMenu } from './mobile-menu';

export function TopNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const quieto = useReducedMotion();

  /**
   * Ruta a la que se acaba de tocar, antes de que Next la confirme.
   *
   * Sin esto, la pestaña activa solo cambiaba cuando la ruta terminaba de
   * montar Y sus datos llegaban. Entre el dedo y la respuesta habia hasta
   * medio segundo en el que la pantalla no acusaba nada: se sentia como si el
   * toque no se hubiera registrado, y la reaccion natural es volver a tocar.
   *
   * Aqui la pestaña se mueve en el mismo cuadro del toque. Es la regla de
   * Apple: responder al pointer-down, no al resultado.
   */
  const [tocada, setTocada] = useState<string | null>(null);

  // Cuando la ruta real alcanza a la tocada, se suelta el optimismo.
  useEffect(() => {
    if (tocada && pathname.startsWith(tocada)) setTocada(null);
  }, [pathname, tocada]);
  const { signOut, user } = useAuth();

  /**
   * Como llamar a quien esta dentro.
   *
   * Supabase no obliga a guardar un nombre, asi que se busca en los metadatos
   * y, si no hay, se usa lo que va antes de la arroba del correo. Peor caso,
   * queda vacio y la barra se ve como antes de que hubiera sesion — nunca un
   * "undefined" ni un hueco raro.
   */
  const meta = (user?.user_metadata ?? {}) as { nombre?: string; full_name?: string };
  const nombreUsuario =
    meta.nombre?.trim() || meta.full_name?.trim() || user?.email?.split('@')[0] || '';
  const { theme, setTheme } = useTheme();
  const [apiOk, setApiOk] = useState<boolean | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  // El sondeo lo hace el proveedor, montado en el shell. Aqui solo se lee el
  // total, que el navbar esta en TODAS las pantallas: el aviso llega estes
  // donde estes, no solo con la pestaña de WhatsApp abierta.
  const { total: esperando } = useHandoffs();

  useEffect(() => {
    let vivo = true;
    const revisar = () =>
      endpoints
        .health()
        .then(() => vivo && setApiOk(true))
        .catch(() => vivo && setApiOk(false));

    revisar();
    // Revisa cada 30s: si el backend se cae a media jornada, el punto lo dice
    // sin que haya que recargar la pagina.
    const id = setInterval(revisar, 30_000);
    return () => {
      vivo = false;
      clearInterval(id);
    };
  }, []);

  return (
    <header className="flex h-topbar shrink-0 items-center border-b border-border bg-surface">
      {/* Grid [1fr auto 1fr]: el menu queda centrado siempre, sin depender de
          que marca y acciones midan lo mismo. */}
      <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 lg:px-4">
        <Link href="/dashboard" className="flex items-center gap-2 justify-self-start">
          <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-primary text-sm font-bold text-primary-foreground">
            B
          </span>
          {/* Quien entro, no como se llama la aplicacion.
              El dueño sabe perfectamente que abrio; repetirselo en cada
              pantalla no le dice nada. Saber con que cuenta esta dentro si:
              es el unico sitio donde aparece, y el dia que haya dos personas
              en el negocio es lo primero que hay que poder mirar. */}
          <span className="hidden max-w-[14ch] truncate text-sm font-semibold tracking-tight sm:block">
            {nombreUsuario}
          </span>
        </Link>

        <nav className="hidden justify-self-center rounded-md bg-muted p-0.5 lg:flex">
          {navItems.map((item) => {
            // El destino tocado manda sobre la ruta real mientras navega.
            const active = tocada
              ? tocada === item.href
              : pathname.startsWith(item.href);
            const Icon = item.icon;
            const pendientes = item.href === '/whatsapp' ? esperando : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                aria-current={active ? 'page' : undefined}
                // Al pasar el raton se pide la ruta por adelantado: cuando el
                // dedo llega, el codigo ya esta.
                onMouseEnter={() => router.prefetch(item.href)}
                // pointerdown, no click: el toque se acusa al bajar el dedo.
                onPointerDown={() => setTocada(item.href)}
                className={cn(
                  'relative flex h-7 items-center gap-1.5 rounded-sm px-2.5 text-sm font-medium transition-colors',
                  active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {/* La pastilla es un elemento COMPARTIDO entre pestañas: con el
                    mismo `layoutId`, framer-motion la desliza de una a otra en
                    vez de apagarla aqui y encenderla alla. El movimiento es lo
                    que dice "vas para alla" sin necesidad de leer. */}
                {active ? (
                  <motion.span
                    layoutId={quieto ? undefined : 'pestana-activa'}
                    className="absolute inset-0 rounded-sm bg-surface shadow-sm"
                    transition={{ type: 'spring', bounce: 0, duration: 0.32 }}
                  />
                ) : null}
                <Icon className={cn('relative', active ? 'text-primary' : 'opacity-70')} />
                <span className="relative">{item.label}</span>
                {pendientes > 0 && <Badge n={pendientes} />}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1 justify-self-end">
          <span
            className="mr-1 hidden items-center gap-1.5 xl:flex"
            title={apiOk ? 'Conectado al servidor' : 'Sin conexion al servidor'}
          >
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                apiOk === null && 'bg-muted-foreground',
                apiOk === true && 'bg-success',
                apiOk === false && 'bg-danger'
              )}
            />
            <span className="text-2xs text-muted-foreground">
              {apiOk === null ? 'Conectando' : apiOk ? 'En linea' : 'Sin conexion'}
            </span>
          </span>
          <Button
            variant="ghost"
            size="icon"
            title="Cambiar tema"
            aria-label="Cambiar tema"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            <IconTema />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Cerrar sesion"
            aria-label="Cerrar sesion"
            onClick={async () => {
              await signOut();
              toast.success('Sesion cerrada');
            }}
          >
            <IconSalir />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="relative lg:hidden"
            aria-label={
              esperando > 0
                ? `Abrir menu — ${esperando} chats esperando`
                : 'Abrir menu'
            }
            onClick={() => setMobileOpen(true)}
          >
            <IconMenu />
            {/* En movil el menu esta colapsado, asi que el badge de la pestaña
                no se ve: se repite sobre el boton que si esta a la vista. */}
            {esperando > 0 && <Badge n={esperando} />}
          </Button>
        </div>
      </div>
      <MobileMenu open={mobileOpen} onOpenChange={setMobileOpen} />
    </header>
  );
}

/**
 * El contador de chats esperando a una persona.
 *
 * Ambar con un punto rojo latiendo: el ambar se lee sin alarmar y el
 * movimiento es lo que hace que el ojo lo encuentre sin buscarlo. El punto
 * respeta `motion-reduce` — un parpadeo constante es justo lo que la gente
 * con sensibilidad al movimiento desactiva.
 */
function Badge({ n }: { n: number }) {
  return (
    <span
      className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-warning px-1 text-2xs font-bold leading-none text-background"
      title={`${n} ${n === 1 ? 'chat espera' : 'chats esperan'} a una persona`}
    >
      {n > 9 ? '9+' : n}
      <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 animate-pulse rounded-full bg-danger motion-reduce:animate-none" />
    </span>
  );
}
