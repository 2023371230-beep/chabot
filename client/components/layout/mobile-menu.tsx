'use client';

import * as Dialog from '@radix-ui/react-dialog';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconCerrar } from '@/client/components/icons';
import { navItems } from '@/client/lib/constants';
import { cn } from '@/client/lib/utils';
import { useAuth } from '@/client/hooks/use-auth';

export function MobileMenu({
  open,
  onOpenChange
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const { user } = useAuth();

  // Mismo criterio que la barra de arriba: quien entro, no como se llama la
  // aplicacion. En el movil ademas es el UNICO sitio donde cabe el dato.
  const meta = (user?.user_metadata ?? {}) as { nombre?: string; full_name?: string };
  const nombreUsuario =
    meta.nombre?.trim() || meta.full_name?.trim() || user?.email?.split('@')[0] || 'Bascula';

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed inset-x-3 top-3 z-50 rounded-lg border border-border bg-surface shadow-lg">
          <div className="flex items-center justify-between border-b border-rule px-3 py-2.5">
            <Dialog.Title className="max-w-[18ch] truncate text-sm font-semibold">
              {nombreUsuario}
            </Dialog.Title>
            <Dialog.Close aria-label="Cerrar menu" className="rounded-sm p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
              <IconCerrar />
            </Dialog.Close>
          </div>
          <div className="flex flex-col">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => onOpenChange(false)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    // 44px de alto: destino tactil comodo en movil.
                    'flex h-11 items-center gap-2.5 border-b border-rule px-3 text-sm font-medium last:border-b-0',
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground'
                  )}
                >
                  <Icon />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
