# Crear tu usuario y volver a encender el login

El código de autenticación nunca se quitó: sigue completo. Lo único que hay es
un interruptor (`NEXT_PUBLIC_DISABLE_AUTH`) puesto en `true` porque no existía
ningún usuario y no se podía entrar.

Son tres pasos y no hace falta tocar código.

---

## Paso 1 — Crear el usuario en Supabase

1. Entra a [supabase.com/dashboard](https://supabase.com/dashboard) y abre el
   proyecto **`zbukglthlybwbeevbozv`**.
2. Menú izquierdo → **Authentication** → **Users**.
3. Botón **Add user** → **Create new user**.
4. Llena:

   | Campo | Qué poner |
   |---|---|
   | **Email** | tu correo, por ejemplo `kimharuka887@gmail.com` |
   | **Password** | una contraseña que recuerdes, mínimo 6 caracteres |
   | **Auto Confirm User** | ✅ **actívalo** |

5. **Create user**.

> **Ese "Auto Confirm User" importa.** Sin él, Supabase manda un correo de
> verificación y la cuenta queda inactiva hasta que se abra el enlace. Como el
> proyecto no tiene servidor de correo configurado, ese correo nunca llega y el
> usuario queda inservible. Con la casilla activada, la cuenta sirve de
> inmediato.

Debe aparecer tu correo en la lista con la columna **Last sign in** vacía.

---

## Paso 2 — Cerrar el registro público

Por defecto, **cualquiera con la llave pública puede crearse una cuenta** — y
esa llave viaja al navegador, así que está a la vista de quien abra el
inspector. Si el dashboard queda en internet sin cerrar esto, alguien puede
registrarse solo y entrar.

En **Authentication → Sign In / Providers → Email**:

- **Allow new users to sign up** → **desactivar**

Con eso, la única forma de crear usuarios es la que acabas de usar: a mano,
desde el panel de Supabase.

---

## Paso 3 — Encender el login

En `frontend/.env.local`, cambia:

```diff
- NEXT_PUBLIC_DISABLE_AUTH=true
+ NEXT_PUBLIC_DISABLE_AUTH=false
```

Y reinicia el servidor (las variables `NEXT_PUBLIC_*` se hornean en el build,
no se releen solas):

```bash
cd frontend && npm run dev
```

Entra a `http://localhost:3000` — debe mandarte a `/login`. Usa el correo y la
contraseña del paso 1.

**En Vercel:** simplemente **no pongas** `NEXT_PUBLIC_DISABLE_AUTH`. Sin la
variable, el login está activo. Si ya la habías puesto, bórrala y vuelve a
desplegar.

---

## Antes de darlo por cerrado

Hay algo que el login **todavía no protege**, y conviene saberlo:

El login cubre **las pantallas**, no **la API**. Las rutas de
`frontend/app/api/**` siguen abiertas a quien conozca la URL:

```bash
# esto funciona aunque no hayas iniciado sesion
curl https://TU-DOMINIO.vercel.app/api/pedidos
```

En localhost da igual. Desplegado importa, porque confirmar un pedido
**descuenta stock real**. El webhook de WhatsApp sí está cerrado (verifica la
firma de Meta; un POST sin firmar recibe 401), pero el resto no.

Cerrarlo es leer el JWT de Supabase en cada `route.ts` y rechazar lo que no
traiga sesión válida. Es el siguiente trabajo pendiente y está anotado en
[PROYECTO.md](PROYECTO.md) como el punto rojo.

---

## Si algo sale mal

**"Invalid login credentials"** — la contraseña no coincide, o el usuario no
quedó confirmado. En Authentication → Users, abre el usuario: si
**Email Confirmed At** está vacío, bórralo y créalo de nuevo con
*Auto Confirm User* activado.

**Entra pero se sale solo** — revisa que `NEXT_PUBLIC_SUPABASE_URL` y
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en `.env.local` sean del mismo proyecto
donde creaste el usuario.

**Sigue entrando sin pedir contraseña** — quedó `NEXT_PUBLIC_DISABLE_AUTH=true`
o no reiniciaste el servidor.
