'use client';

import * as Dialog from '@radix-ui/react-dialog';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { navItems } from '@/lib/constants';
import { cn } from '@/lib/utils';

export function MobileMenu({
  open,
  onOpenChange
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const pathname = usePathname();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md" />
        <Dialog.Content className="fixed inset-x-4 top-4 z-50 rounded-3xl border border-border bg-card p-6 shadow-soft">
          <div className="mb-8 flex items-center justify-between">
            <div className="text-sm font-semibold">Pollito Admin</div>
            <Dialog.Close className="rounded-full p-2 hover:bg-muted">
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          <div className="grid gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => onOpenChange(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-2xl px-4 py-4 text-lg font-medium text-muted-foreground',
                    active && 'bg-primary text-primary-foreground'
                  )}
                >
                  <Icon className="h-5 w-5" />
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
