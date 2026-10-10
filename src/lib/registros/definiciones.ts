// Registro de módulos genéricos. Cada hito agrega aquí los suyos.
import type { Definicion } from "./tipos";
import { RIESGOS, STAKEHOLDERS, WBS } from "./modulos/planificacion";
import { HITOS, REUNIONES } from "./modulos/seguimiento";

export const DEFINICIONES: Record<string, Definicion> = {
  stakeholders: STAKEHOLDERS,
  wbs: WBS,
  riesgos: RIESGOS,
  hitos: HITOS,
  reuniones: REUNIONES,
};

export function obtenerDefinicion(clave: string): Definicion | null {
  return Object.prototype.hasOwnProperty.call(DEFINICIONES, clave) ? DEFINICIONES[clave] : null;
}
