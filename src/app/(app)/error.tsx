"use client";

import { claseBoton } from "@/components/ui";

// Se muestra si algo falla dentro del área interna (por ejemplo, una acción
// que la base de datos rechaza). No expone detalles técnicos al usuario.
export default function ErrorInterno({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-md rounded-card bg-leaf-50 p-8 text-center">
      <h1 className="mb-2 font-display text-2xl font-bold text-leaf-700">
        No pudimos completar la acción
      </h1>
      <p className="mb-5 text-sm text-muted">
        Puede ser un problema de conexión o que no tengas permiso para hacerlo.
        Intenta de nuevo; si persiste, avisa al administrador.
      </p>
      <button onClick={reset} className={claseBoton.primario}>
        Reintentar
      </button>
      {error.digest && (
        <p className="mt-4 text-xs text-muted">Referencia para el administrador: {error.digest}</p>
      )}
    </div>
  );
}
