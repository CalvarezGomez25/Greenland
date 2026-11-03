// Comparativo de ofertas de un proceso de contratación (capa 3 del módulo de aliados, paquete RAÍZ).
// Los puntajes NO se guardan: se calculan aquí con los pesos de los parámetros. Funciones puras (sin red).
//  - Puntaje de precio = 100 × menor valor de la ronda ÷ valor de la oferta (solo ofertas con valor y no descartadas), un decimal.
//  - Puntaje cualitativo = promedio ponderado de los cinco criterios (1 a 5) llevado a 100, un decimal; exige los cinco.
//  - Puntaje total = precio × peso_precio + cualitativo × (1 − peso_precio), un decimal; una oferta no habilitada no recibe total.
//  - Orden en la ronda: primero por puntaje total y, si falta el cualitativo, por el de precio (después de las que tienen total).
// Montos en centavos (bigint); los pesos entran como fracciones y se pasan a diezmilésimas para no usar decimales flotantes.

import { diasParaVencer } from "../actividades";
import { numeroParametro, type FilaParametro } from "../pmo/parametros";

export type EstadoOferta = "invitado" | "recibida" | "en_aclaracion" | "descartada" | "adjudicada" | "no_presento" | "por_confirmar";
export const ETIQUETA_ESTADO_OFERTA: Record<EstadoOferta, string> = {
  invitado: "Invitado", recibida: "Recibida", en_aclaracion: "En aclaración", descartada: "Descartada", adjudicada: "Adjudicada", no_presento: "No presentó", por_confirmar: "Por confirmar",
};
export type EstadoProceso = "en_preparacion" | "abierta" | "en_evaluacion" | "adjudicada" | "desierta" | "cancelada" | "por_confirmar";
export const ETIQUETA_ESTADO_PROCESO: Record<EstadoProceso, string> = {
  en_preparacion: "En preparación", abierta: "Abierta", en_evaluacion: "En evaluación", adjudicada: "Adjudicada", desierta: "Desierta", cancelada: "Cancelada", por_confirmar: "Por confirmar",
};
export const ETIQUETA_TIPO_SERVICIO: Record<string, string> = {
  obra_civil: "Obra civil y edificación", estructuras: "Puentes y estructuras", hidraulicas: "Obras hidráulicas", vias: "Vías y urbanismo",
  diseno: "Diseño y consultoría", interventoria: "Interventoría", suministro: "Suministro", otro: "Otro",
};
export const CRITERIOS = [
  { campo: "crit_experiencia", etiqueta: "Experiencia", peso: "peso_experiencia" },
  { campo: "crit_capacidad", etiqueta: "Capacidad técnica", peso: "peso_capacidad" },
  { campo: "crit_programacion", etiqueta: "Programación y plazo", peso: "peso_programacion" },
  { campo: "crit_comercial", etiqueta: "Condiciones comerciales", peso: "peso_comercial" },
  { campo: "crit_sst", etiqueta: "SST y documentación", peso: "peso_sst" },
] as const;

export type PesosOferta = { precio: number; criterios: [number, number, number, number, number] };
export function pesosDeOfertas(filas: FilaParametro[], proyectoId?: string | null): PesosOferta {
  const ctx = { proyectoId: proyectoId ?? null, portafolioId: null };
  return {
    precio: numeroParametro(filas, "peso_precio", ctx, 0.4),
    criterios: [
      numeroParametro(filas, "peso_experiencia", ctx, 0.15), numeroParametro(filas, "peso_capacidad", ctx, 0.15),
      numeroParametro(filas, "peso_programacion", ctx, 0.1), numeroParametro(filas, "peso_comercial", ctx, 0.1), numeroParametro(filas, "peso_sst", ctx, 0.1),
    ],
  };
}

export type OfertaEntrada = {
  id: string; ronda: number; estado: EstadoOferta; habilitada: "si" | "no" | null;
  valor: bigint | null; // centavos; null o 0 = sin valor
  criterios: [number | null, number | null, number | null, number | null, number | null];
  vigenciaHasta: string | null;
};
export type OfertaCalculada = {
  id: string; precio: number | null; cualitativo: number | null; total: number | null; orden: number | null;
  difMenor: number | null; // valor ÷ menor valor de la ronda − 1
  difPresupuesto: number | null; // valor ÷ presupuesto de referencia − 1
  vigencia: "rojo" | "ambar" | "verde" | null;
};

const bp = (x: number) => Math.round(x * 10_000); // fracción → diezmilésimas
// Redondeo de Excel (mitad hacia arriba para positivos) a un decimal, sobre un valor expresado en décimas × 10⁴ (entero).
const aDecimas = (x10000: bigint): number => Number((x10000 * 2n + 10_000n) / 20_000n) / 10; // x/10000 redondeado a entero, luego /10

export function calcularOfertas(ofertas: OfertaEntrada[], presupuestoReferencia: bigint | null, pesos: PesosOferta, hoy: string, alertaDias: number): Map<string, OfertaCalculada> {
  const out = new Map<string, OfertaCalculada>();
  const conValor = (o: OfertaEntrada) => o.valor !== null && o.valor > 0n;
  const menorPorRonda = new Map<number, bigint>();
  for (const o of ofertas) {
    if (!conValor(o) || o.estado === "descartada") continue;
    const m = menorPorRonda.get(o.ronda);
    if (m === undefined || (o.valor as bigint) < m) menorPorRonda.set(o.ronda, o.valor as bigint);
  }
  const wp = bp(pesos.precio), wc = pesos.criterios.map(bp), sumaW = wc.reduce((a, b) => a + b, 0);
  for (const o of ofertas) {
    const menor = menorPorRonda.get(o.ronda);
    const valido = conValor(o) && o.estado !== "descartada" && menor !== undefined;
    // 100 × menor / valor, redondeado a un decimal: (menor × 1000 / valor) con redondeo → décimas
    const precio = valido ? Number(((menor as bigint) * 2000n + (o.valor as bigint)) / (2n * (o.valor as bigint))) / 10 : null;
    const completo = o.criterios.every((c) => c !== null);
    let cualitativo: number | null = null;
    if (completo && sumaW > 0) {
      const s = o.criterios.reduce<number>((a, c, i) => a + (c as number) * wc[i], 0); // Σ c×w (diezmilésimas)
      // (Σ c×w / Σ w) / 5 × 100 = Σ c×w × 20 / Σ w, a un decimal (mitad hacia arriba)
      cualitativo = Number((BigInt(s) * 400n + BigInt(sumaW)) / (2n * BigInt(sumaW))) / 10;
    }
    let total: number | null = null;
    if (precio !== null && cualitativo !== null && o.habilitada !== "no") {
      total = aDecimas(BigInt(Math.round(precio * 10)) * BigInt(wp) + BigInt(Math.round(cualitativo * 10)) * BigInt(10_000 - wp));
    }
    let vigencia: OfertaCalculada["vigencia"] = null;
    if (o.vigenciaHasta && (o.estado === "recibida" || o.estado === "en_aclaracion")) {
      const d = diasParaVencer(o.vigenciaHasta, hoy);
      vigencia = d < 0 ? "rojo" : d <= alertaDias ? "ambar" : "verde";
    }
    out.set(o.id, {
      id: o.id, precio, cualitativo, total, orden: null,
      difMenor: valido ? Number(((o.valor as bigint) * 10_000n) / (menor as bigint) - 10_000n) / 10_000 : null,
      difPresupuesto: conValor(o) && presupuestoReferencia && presupuestoReferencia > 0n ? Number(((o.valor as bigint) * 10_000n) / presupuestoReferencia - 10_000n) / 10_000 : null,
      vigencia,
    });
  }
  // Orden en la ronda: primero las que tienen puntaje total (de mayor a menor) y después las que solo tienen precio (de mayor a menor),
  // para que cada oferta tenga una posición propia (la hoja de RAÍZ compara cada grupo con su propia escala y puede repetir el 1).
  for (const o of ofertas) {
    const c = out.get(o.id) as OfertaCalculada;
    const mismos = ofertas.filter((x) => x.ronda === o.ronda).map((x) => out.get(x.id) as OfertaCalculada);
    const conTotal = mismos.filter((x) => x.total !== null);
    if (c.total !== null) c.orden = conTotal.filter((x) => (x.total as number) > (c.total as number)).length + 1;
    else if (c.precio !== null) c.orden = conTotal.length + mismos.filter((x) => x.total === null && x.precio !== null && x.precio > (c.precio as number)).length + 1;
  }
  return out;
}

// Semáforo de un proceso. Abierto: sin fecha de cierre o a 7 días o menos = ámbar, cierre vencido = rojo. En evaluación: más de los días
// permitidos desde el cierre = rojo; pasado el 70 % = ámbar. Adjudicado sin contrato = ámbar. Por confirmar = ámbar.
export type SemaforoProceso = { nivel: "rojo" | "ambar" | "verde" | null; alerta: string };
export function semaforoProceso(p: { estado: EstadoProceso; cierre: string | null; contratoId: string | null }, hoy: string, evalDias: number): SemaforoProceso {
  const verde: SemaforoProceso = { nivel: "verde", alerta: "" };
  switch (p.estado) {
    case "abierta": {
      if (!p.cierre) return { nivel: "ambar", alerta: "Registra la fecha de cierre de propuestas" };
      const d = diasParaVencer(p.cierre, hoy);
      if (d < 0) return { nivel: "rojo", alerta: "Cierre vencido: pasa el proceso a evaluación o amplía el plazo" };
      if (d <= 7) return { nivel: "ambar", alerta: d === 0 ? "Las propuestas cierran hoy" : `Las propuestas cierran en ${d} ${d === 1 ? "día" : "días"}` };
      return verde;
    }
    case "en_evaluacion": {
      if (!p.cierre) return { nivel: "ambar", alerta: "Registra la fecha de cierre de propuestas" };
      const d = -diasParaVencer(p.cierre, hoy);
      if (d > evalDias) return { nivel: "rojo", alerta: `Evaluación atrasada: ${d} días desde el cierre (máximo ${evalDias})` };
      if (d > evalDias * 0.7) return { nivel: "ambar", alerta: `Evaluación por vencer: ${d} días desde el cierre (máximo ${evalDias})` };
      return verde;
    }
    case "adjudicada":
      return p.contratoId ? verde : { nivel: "ambar", alerta: "Adjudicado sin contrato registrado" };
    case "por_confirmar":
      return { nivel: "ambar", alerta: "Confirma el alcance, los oferentes y el estado del proceso" };
    default:
      return { nivel: null, alerta: "" };
  }
}
