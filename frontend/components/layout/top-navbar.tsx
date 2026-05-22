'use client';

import { CheckCircle2, LogOut, Menu, Moon, Sun } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { endpoints } from '@/lib/api/endpoints';
import { navItems } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { MobileMenu } from './mobile-menu';

export function TopNavbar() {
  const pathname = usePathname();
  const { signOut, user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [backendOk, setBackendOk] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    endpoints
      .health()
      .then(() => setBackendOk(true))
      .catch(() => setBackendOk(false));
  }, []);

  const handleSignOut = async () => {
    await signOut();
    toast.success('Sesion cerrada');
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/82 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-screen-2xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/dashboard" className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-foreground text-sm font-semibold text-background">
            PA
          </span>
          <span className="hidden text-sm font-semibold tracking-tight sm:block">
            Pollito Admin
          </span>
        </Link>

        <nav className="hidden items-center gap-1 rounded-full border border-border bg-card/70 p-1 lg:flex">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'rounded-full px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                  active && 'bg-primary text-primary-foreground'
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Badge
            variant={backendOk ? 'success' : 'danger'}
            className="hidden gap-1 xl:flex"
          >
            <CheckCircle2 className="h-3 w-3" />
            API {backendOk ? 'online' : 'offline'}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            title="Cambiar tema"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            <Sun className="h-4 w-4 dark:hidden" />
            <Moon className="hidden h-4 w-4 dark:block" />
          </Button>
          <div className="hidden max-w-36 truncate text-right text-xs text-muted-foreground md:block">
            {user?.email ?? 'Admin'}
          </div>
          <Button
            variant="ghost"
            size="icon"
            title="Cerrar sesion"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <MobileMenu open={mobileOpen} onOpenChange={setMobileOpen} />
    </header>
  );
}
