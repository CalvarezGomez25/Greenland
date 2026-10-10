// Control de cambios: estados, niveles y reglas de aprobación (especificación, módulo F).
// El cálculo oficial lo hace la base de datos (función cambio_calcular); esta copia en TypeScript
// sirve para mostrar y para probar los casos de la sección 13.8 en cada cambio del código.

import { dividirRedondeado } from "../presupuesto/dinero";
import type { FilaParametro } from "./parametros";
import { numeroParametro, valorParametro } from "./parametros";
import type { NivelCambio } from "./semaforo";

export type EstadoCambio =
  | "identificado" | "radicado" | "evaluacion_tecnica_financiera" | "analisis_impacto"
  | "aprobacion" | "aprobado" | "rechazado" | "implementacion" | "cerrado";

export const ESTADOS_CAMBIO: EstadoCambio[] = [
  "identificado", "radicado", "evaluacion_tecnica_financiera", "analisis_impacto",
  "aprobacion", "aprobado", "rechazado", "implementacion", "cerrado",
];

export const ETIQUETA_ESTADO_CAMBIO: Record<EstadoCambio, string> = {
  identificado: "Identificado",
  radicado: "Radicado",
  evaluacion_tecnica_financiera: "En evaluación técnica y financiera",
  analisis_impacto: "En análisis de impacto",
  aprobacion: "En aprobación",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
  implementacion: "En implementación",
  cerrado: "Cerrado",
};

export const ETIQUETA_NIVEL_CAMBIO: Record<NivelCambio, string> = { menor: "Menor", moderado: "Moderado", critico: "Crítico" };

export const AMBITOS_CAMBIO: [string, string][] = [
  ["alcance", "Alcance"], ["financiero", "Financiero"], ["cronograma", "Cronograma"], ["flujo_caja", "Flujo de caja"],
  ["contractual", "Contractual"], ["operativo", "Operativo"], ["riesgos", "Riesgos"], ["calidad", "Calidad"],
  ["reputacional", "Reputacional"], ["regulatorio", "Regulatorio"],
];

// Cambios que cuentan como "pendientes": los que no están cerrados ni rechazados.
export const esPendiente = (e: string) => e !== "cerrado" && e !== "rechazado";
// Mientras se puede editar el contenido (antes de la aprobación).
export const esEditable = (e: string) => ["identificado", "radicado", "evaluacion_tecnica_financiera", "analisis_impacto"].includes(e);

export function siguienteEstado(e: EstadoCambio): EstadoCambio | null {
  return ({
    identificado: "radicado", radicado: "evaluacion_tecnica_financiera", evaluacion_tecnica_financiera: "analisis_impacto",
    analisis_impacto: "aprobacion", aprobado: "implementacion", implementacion: "cerrado", rechazado: "cerrado",
  } as Partial<Record<EstadoCambio, EstadoCambio>>)[e] ?? null;
}

export type ResultadoNivel = { variacionPct: number | null; nivel: NivelCambio | null; requiereFirma: boolean };

// Montos como bigint en centavos. Comparación exacta, sin redondear.
export function nivelCambio(
  e: { impactoCosto: bigint; base: bigint | null; dias: number; ligadoAContrato: boolean },
  p: { menorMax: number; moderadoMax: number; firmaPct: number } = { menorMax: 2, moderadoMax: 5, firmaPct: 5 },
): ResultadoNivel {
  const abs = e.impactoCosto < 0n ? -e.impactoCosto : e.impactoCosto;
  const base = e.base !== null && e.base > 0n ? e.base : null;
  const pct = (x: number) => BigInt(Math.round(x * 10_000)); // porcentaje con 4 decimales
  const contra = (limite: number) => abs * 100n * 10_000n <= pct(limite) * (base as bigint);
  const variacionPct = abs === 0n ? 0 : base === null ? null : Number(dividirRedondeado(abs * 1_000_000n, base)) / 10_000;
  let nivel: NivelCambio | null;
  if (e.ligadoAContrato && e.dias !== 0) nivel = "critico";
  else if (abs === 0n) nivel = "menor";
  else if (base === null) nivel = null;
  else if (contra(p.menorMax)) nivel = "menor";
  else if (contra(p.moderadoMax)) nivel = "moderado";
  else nivel = "critico";
  const requiereFirma = base !== null && abs > 0n && !contra(p.firmaPct);
  return { variacionPct, nivel, requiereFirma };
}

export type Aprobador = "gerente" | "director_general";

export function quienAprueba(nivel: NivelCambio, parametros: FilaParametro[], ctx: { proyectoId?: string | null; portafolioId?: string | null } = {}): Aprobador {
  const v = valorParametro(parametros, `cambio_aprobador_${nivel === "critico" ? "critico" : nivel}`, ctx);
  return v === "gerente" ? "gerente" : "director_general";
}

export const ETIQUETA_APROBADOR: Record<Aprobador, string> = { gerente: "el gerente del proyecto", director_general: "el director general de planificación y proyectos" };

export function parametrosDeCambio(parametros: FilaParametro[], ctx: { proyectoId?: string | null; portafolioId?: string | null }) {
  return {
    menorMax: numeroParametro(parametros, "cambio_menor_max_pct", ctx, 2),
    moderadoMax: numeroParametro(parametros, "cambio_moderado_max_pct", ctx, 5),
    firmaPct: numeroParametro(parametros, "cambio_firma_patrocinador_pct", ctx, 5),
  };
}

// Días enteros transcurridos desde una fecha ISO.
export function diasDesde(iso: string | null, ahora: Date = new Date()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : Math.max(0, Math.floor((ahora.getTime() - t) / 86_400_000));
}
