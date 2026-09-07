'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { estaFresco, guardarEnCache, leerCache } from '@/lib/api/cache';

/**
 * Carga datos de la API con cache compartida entre pantallas.
 *
 * `clave` identifica QUE se esta pidiendo (por ejemplo `'pedidos'`). Dos
 * pantallas que pidan lo mismo comparten el resultado, y volver a una pantalla
 * ya visitada la pinta llena de inmediato en vez de mostrar su esqueleto.
 *
 * Sin `clave` se comporta como antes: siempre pide. Se deja asi para los casos
 * donde cachear no tiene sentido.
 *
 * `loading` solo es true cuando NO hay nada que mostrar. Si ya hay datos
 * guardados, se pintan y la revalidacion ocurre por detras: un esqueleto sobre
 * datos que ya se tienen es una regresion visual, no una carga.
 */
export function useApi<T>(
  loader: () => Promise<T>,
  deps: React.DependencyList = [],
  clave?: string
) {
  const guardado = clave ? leerCache<T>(clave) : undefined;

  const [data, setData] = useState<T | null>(guardado ?? null);
  const [loading, setLoading] = useState(guardado === undefined);
  const [error, setError] = useState<string | null>(null);

  // El componente puede desmontarse mientras la peticion viaja (cambio de
  // menu). Escribir estado despues avisa en consola y no sirve de nada.
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  const load = useCallback(
    async (silencioso = false) => {
      if (!silencioso) setLoading(true);
      setError(null);
      try {
        const resultado = await loader();
        if (clave) guardarEnCache(clave, resultado);
        if (vivo.current) setData(resultado);
      } catch (err) {
        // Un fallo al revalidar no borra lo que ya se esta mostrando: es mejor
        // un dato de hace un minuto que una pantalla de error sobre datos que
        // el usuario ya tenia delante.
        if (vivo.current && !silencioso) {
          setError(err instanceof Error ? err.message : 'Error inesperado');
        }
      } finally {
        if (vivo.current) setLoading(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [clave, ...deps]
  );

  useEffect(() => {
    // Con datos frescos en cache no se pide nada. Con datos rancios se pintan
    // igual y se revalida en silencio.
    if (clave && leerCache(clave) !== undefined) {
      if (!estaFresco(clave)) void load(true);
      return;
    }
    void load();
  }, [clave, load]);

  return { data, loading, error, refetch: () => load(), setData };
}
