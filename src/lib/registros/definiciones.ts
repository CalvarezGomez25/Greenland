// Registro de módulos genéricos. Cada hito agrega aquí los suyos.
import type { Definicion } from "./tipos";

export const DEFINICIONES: Record<string, Definicion> = {};

export function obtenerDefinicion(clave: string): Definicion | null {
  return Object.prototype.hasOwnProperty.call(DEFINICIONES, clave) ? DEFINICIONES[clave] : null;
}
