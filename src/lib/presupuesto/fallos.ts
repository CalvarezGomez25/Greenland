// Texto corto y seguro para mostrar cuando algo falla al preparar el presupuesto: dice QUÉ falló
// (qué tabla, qué código) sin revelar mensajes internos de la base de datos ni datos de nadie.

import { ErrorLecturaTabla } from "./datos";

export function describirFallo(e: unknown): string {
  if (e instanceof ErrorLecturaTabla) {
    return `no se pudo leer «${e.tabla}»${e.codigo ? ` (código ${e.codigo})` : ""}`;
  }
  if (e instanceof RangeError) return "un valor numérico está fuera de rango o con demasiada precisión";
  if (e instanceof Error) return `error de tipo ${e.name}`;
  return "error desconocido";
}
