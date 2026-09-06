/**
 * Configuracion de Next.
 *
 * Lo unico que aporta aqui, ademas del modo estricto, son las cabeceras de
 * seguridad. Van en la configuracion y no en un middleware porque asi las
 * aplica el servidor a TODA respuesta — incluidos los archivos estaticos y las
 * paginas de error, que es justo donde se olvidan cuando se ponen a mano.
 */

/** Origen de Supabase: el navegador tiene que poder hablar con el. */
const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

/**
 * Politica de contenido.
 *
 * Es la defensa de fondo contra XSS: aunque alguien lograra inyectar un script
 * en la pagina, el navegador se niega a ejecutarlo si no viene de un origen
 * permitido. Importa mas de lo normal en esta aplicacion porque la sesion de
 * Supabase vive en `localStorage`, accesible desde JavaScript; la CSP es lo que
 * hace que ese JavaScript hostil no llegue a ejecutarse.
 *
 * `'unsafe-inline'` en los estilos es una concesion consciente: Next inyecta
 * CSS en linea para las fuentes y el tema, y quitarlo obligaria a un `nonce`
 * por peticion, que rompe el renderizado estatico. En los SCRIPTS no se
 * concede, que es donde de verdad importa.
 *
 * En desarrollo se añade `'unsafe-eval'` porque el refresco rapido de Next lo
 * necesita. En produccion no va: seria dejar abierta la puerta que la CSP
 * viene a cerrar.
 */
const esDesarrollo = process.env.NODE_ENV !== 'production';

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${esDesarrollo ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob:",
  `connect-src 'self' ${SUPABASE} https://*.supabase.co wss://*.supabase.co`,
  // El dashboard no incrusta nada de terceros ni debe poder ser incrustado:
  // `frame-ancestors 'none'` es lo que impide el secuestro de clics.
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  // Limita a donde puede enviarse un formulario: sin esto, un script inyectado
  // podria reapuntar el login a un servidor ajeno y cosechar contraseñas.
  "form-action 'self'",
  "base-uri 'self'",
  'upgrade-insecure-requests'
].join('; ');

const cabeceras = [
  { key: 'Content-Security-Policy', value: csp },

  // Fuerza HTTPS durante un año. Solo tiene efecto sobre HTTPS, asi que en
  // localhost es inocua.
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains'
  },

  // Impide que el navegador adivine el tipo de un archivo: sin esto, un
  // archivo subido puede acabar ejecutandose como script.
  { key: 'X-Content-Type-Options', value: 'nosniff' },

  // Redundante con `frame-ancestors`, para navegadores viejos.
  { key: 'X-Frame-Options', value: 'DENY' },

  // No filtrar la ruta completa al salir del sitio. Las URLs del dashboard
  // llevan ids de pedidos y clientes.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },

  // El dashboard no usa camara, microfono ni ubicacion. Negarlos evita que un
  // script inyectado los pida en nombre del sitio.
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  }
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // El encabezado `X-Powered-By: Next.js` anuncia la tecnologia y su version
  // aproximada. No es una vulnerabilidad, pero es informacion gratis para
  // quien busca objetivos con una version concreta.
  poweredByHeader: false,

  async headers() {
    return [{ source: '/:path*', headers: cabeceras }];
  }
};

export default nextConfig;
