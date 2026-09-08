'use client';

import { useEffect } from 'react';

/**
 * Atajos de teclado de una sola tecla.
 *
 * El dueño abre la misma pantalla cincuenta veces al dia y siempre hace lo
 * mismo: buscar un cliente o capturar un pedido. Obligarlo a cruzar la
 * pantalla con el raton para las dos cosas que mas repite es la definicion de
 * friccion innecesaria.
 *
 * SE IGNORAN mientras se escribe. Sin esa comprobacion, teclear "no llego el
 * pollo" en las notas de un pedido dispararia el atajo de la `n` y abriria un
 * dialogo encima. Tambien se ignoran con Ctrl/Cmd/Alt, para no pisar los
 * atajos del navegador.
 */
const escribiendo = (destino: EventTarget | null): boolean => {
  const el = destino as HTMLElement | null;
  if (!el) return false;
  const etiqueta = el.tagName;
  return (
    etiqueta === 'INPUT' ||
    etiqueta === 'TEXTAREA' ||
    etiqueta === 'SELECT' ||
    el.isContentEditable
  );
};

export function useAtajos(mapa: Record<string, () => void>): void {
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (escribiendo(e.target)) return;

      const accion = mapa[e.key.toLowerCase()];
      if (!accion) return;

      e.preventDefault();
      accion();
    };

    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [mapa]);
}
