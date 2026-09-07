/**
 * Carga las variables de entorno para los scripts sueltos.
 *
 * Next lee `.env.local` solo, pero `dotenv/config` a secas busca `.env`, que
 * en este proyecto no existe. Sin esto los scripts fallan con un
 * "Missing required environment variable: SUPABASE_URL" que parece un
 * problema de configuracion y en realidad es el nombre del archivo.
 *
 * Va como primer import de cada script, ANTES de cualquier otro: los modulos
 * del servidor leen `process.env` al importarse.
 */
import { config } from 'dotenv';
import path from 'node:path';

config({ path: path.resolve(__dirname, '..', '.env.local') });
