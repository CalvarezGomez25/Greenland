// Registro de módulos genéricos. Cada hito agrega aquí los suyos.
import type { Definicion } from "./tipos";
import { RIESGOS, STAKEHOLDERS, WBS } from "./modulos/planificacion";

export const DEFINICIONES: Record<string, Definicion> = {
  stakeholders: STAKEHOLDERS,
  wbs: WBS,
  riesgos: RIESGOS,
};

export function obtenerDefinicion(clave: string): Definicion | null {
  return Object.prototype.hasOwnProperty.call(DEFINICIONES, clave) ? DEFINICIONES[clave] : null;
}
