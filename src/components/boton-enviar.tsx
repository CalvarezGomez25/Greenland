"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

// Botón de envío que se desactiva mientras el formulario se procesa
// (evita enviar dos veces por un doble clic).
export function BotonEnviar({
  children,
  className,
  textoEnviando = "Procesando…",
}: {
  children: ReactNode;
  className: string;
  textoEnviando?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? textoEnviando : children}
    </button>
  );
}
