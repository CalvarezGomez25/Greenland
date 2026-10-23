"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Contenedor con desplazamiento horizontal que, al abrirse, deja «hoy» a la vista (en el celular la línea es más ancha que la pantalla).
export function DesplazarAHoy({ xHoy, children, etiqueta }: { xHoy: number; children: ReactNode; etiqueta: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollLeft = xHoy > el.clientWidth * 0.7 ? xHoy - el.clientWidth / 3 : 0; // solo se desplaza si «hoy» no se ve cómodo
  }, [xHoy]);
  return (
    <div ref={ref} className="overflow-x-auto pb-2" role="group" aria-label={etiqueta} tabIndex={0}>
      {children}
    </div>
  );
}
