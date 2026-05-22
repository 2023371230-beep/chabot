import { LoginForm } from '@/features/auth/login-form';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#fff7cc,transparent_32%),hsl(var(--background))] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            Distribuidora avicola
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">Pollito Admin</h1>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
