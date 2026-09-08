# Báscula

Pedidos, kilos e inventario de una distribuidora avícola, con un asistente que
toma pedidos por WhatsApp.

```bash
npm install
npm run dev          # http://localhost:3000
```

---

## Dónde está cada cosa

La regla es una sola: **el front no sabe nada de la base de datos, y el back no
sabe nada del navegador.** Lo único que cruza esa línea son las rutas de
`app/api/`, y son adaptadores de diez líneas.

```
app/            Las URLs. Nada más.
  ├── */page.tsx      las nueve pantallas
  └── api/**/route.ts la puerta al servidor: valida y delega, no razona

client/         TODO el front. Nunca importa de server/.
  ├── components/     lo reutilizable: ui/, shared/, layout/, icons/, motion/
  ├── features/       una carpeta por dominio (pedidos, whatsapp, reportes...)
  ├── hooks/          estado y datos del lado del navegador
  ├── lib/            cliente HTTP, caché, formateadores
  └── types/          las formas que pinta la interfaz

server/         TODO el back. Nunca importa de client/.
  ├── modules/        una carpeta por dominio, con su service y sus schemas
  ├── database/       el cliente de Supabase con la llave secreta
  ├── http/           envoltorios de ruta: sesión, validación, errores
  ├── config/         variables de entorno, validadas al arrancar
  └── shared/         utilidades del servidor

shared/         Lo poquísimo que usan los dos lados. Módulos PUROS.
scripts/        Las pruebas. Se corren con npm.
sql/            Migraciones, en orden. Se pegan en Supabase.
docs/           Sistema de diseño y textos de la interfaz.
```

`app/` es la única carpeta con las dos cosas dentro, y no por gusto: Next exige
que las páginas y las rutas de API vivan ahí. La separación se mantiene igual,
porque un `route.ts` no contiene lógica — llama a `server/` y devuelve.

### Por qué la app está en la raíz y no en `frontend/`

Vercel construye lo que encuentra en la raíz del repositorio. Con la aplicación
un nivel más abajo hay que acordarse de poner **Root Directory**, y si se
olvida el despliegue "termina bien" y sirve un 404 sin explicar por qué.

---

## Pruebas

Ninguna usa simulacros para lo que importa: van contra la base y la IA reales,
con teléfonos que empiezan por `52100000000` y que `limpiar:pruebas` borra.

| Comando | Qué comprueba |
|---|---|
| `npm run simular` | 67 mensajes reales contra el clasificador, y cuánta IA gastarían |
| `npm run simular:conversaciones` | La memoria entre mensajes: cotizaciones, reenvíos, duplicados |
| `npm run probar:doble-confirmacion` | Que ningún pedido nazca sin un "sí" del cliente |
| `npm run probar:conversaciones` | El enlace pedido↔conversación y el silencio inteligente |
| `npm run probar:handoff` | Cuándo el bot se calla y llama a una persona |
| `npm run probar:seguridad` | La API con sesión y con tokens manipulados |
| `npm run probar:produccion` | El build real: rutas, cabeceras y API cerrada |
| `npm run probar:secretos` | Que ninguna llave se escape: git, historial y paquete del navegador |
| `npm run limpiar:pruebas` | Borra lo que dejaron las pruebas |

`probar:seguridad` necesita `npm run dev` levantado.
`probar:produccion` necesita `npm run build` antes, y levanta su propio servidor.

---

## Documentación

| Archivo | Qué cuenta |
|---|---|
| [PROYECTO.md](PROYECTO.md) | Las decisiones y los errores que costaron caro |
| [DESPLIEGUE.md](DESPLIEGUE.md) | Subirlo a Vercel, paso a paso |
| [SEGURIDAD.md](SEGURIDAD.md) | Qué protege cada capa y contra qué |
| [LOGIN.md](LOGIN.md) | Crear usuarios en Supabase |
| [sql/README.md](sql/README.md) | En qué orden van las migraciones |
