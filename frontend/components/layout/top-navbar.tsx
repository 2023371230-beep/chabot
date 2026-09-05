'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { IconMenu, IconSalir, IconTema } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { endpoints } from '@/lib/api/endpoints';
import { navItems } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { MobileMenu } from './mobile-menu';

export function TopNavbar() {
  const pathname = usePathname();
  const { signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [apiOk, setApiOk] = useState<boolean | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

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
          <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-primary text-[13px] font-bold text-primary-foreground">
            B
          </span>
          <span className="hidden text-sm font-semibold tracking-tight sm:block">
            Bascula
          </span>
        </Link>

        <nav className="hidden justify-self-center rounded-md bg-muted p-0.5 lg:flex">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-7 items-center gap-1.5 rounded-sm px-2.5 text-[13px] font-medium transition-colors',
                  active
                    ? 'bg-surface text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className={cn(active ? 'text-primary' : 'opacity-70')} />
                {item.label}
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
            className="lg:hidden"
            aria-label="Abrir menu"
            onClick={() => setMobileOpen(true)}
          >
            <IconMenu />
          </Button>
        </div>
      </div>
      <MobileMenu open={mobileOpen} onOpenChange={setMobileOpen} />
    </header>
  );
}
