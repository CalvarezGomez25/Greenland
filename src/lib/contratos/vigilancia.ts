// Vigilancia de un contrato: la etapa de su ruta de vida y un semáforo único (Verde, Ámbar, Rojo).
// Vigila la etapa, el plazo, la autorización de asamblea (capa 1), la suspensión, las pólizas y los documentos
// del contratista (capa 2) y los compromisos de las comunicaciones (capa 3).
// Funciones puras (sin red). Las reglas salen de RAÍZ (hoja de reglas de negocio); los días y topes son parámetros.

import { diasParaVencer } from "../actividades";
import { numeroParametro, type FilaParametro } from "../pmo/parametros";

export type Etapa = { n: number; nombre: string; responsable: string; accion: string; parametroDias?: string };

// Ruta de vida de 9 etapas. Los días máximos (supuesto de diseño de RAÍZ) viven en los parámetros etapa_dias_max_N.
export const ETAPAS: Etapa[] = [
  { n: 1, nombre: "Preparación", responsable: "Gerente del proyecto", accion: "Completar datos, generar la minuta y validar alcance, cantidades, precios y plazo con la interventoría", parametroDias: "etapa_dias_max_1" },
  { n: 2, nombre: "Revisión del contratista", responsable: "Contratista", accion: "Recibir las observaciones técnicas y jurídicas del contratista y cerrar la versión final", parametroDias: "etapa_dias_max_2" },
  { n: 3, nombre: "Aprobación Greenland", responsable: "Jurídica, dirección y gerencia general según monto", accion: "Visto bueno jurídico sobre la versión final y aprobación según el nivel que corresponda", parametroDias: "etapa_dias_max_3" },
  { n: 4, nombre: "Firmas", responsable: "Contratista y representante legal del contratante", accion: "Firma del contratista y luego del representante legal de Greenland", parametroDias: "etapa_dias_max_4" },
  { n: 5, nombre: "Garantías e inicio", responsable: "Contratista, corredor de seguros e interventor", accion: "Expedir y aprobar pólizas sobre el contrato firmado y firmar el acta de inicio", parametroDias: "etapa_dias_max_5" },
  { n: 6, nombre: "Ejecución", responsable: "Interventor", accion: "Seguimiento, cortes, modificaciones y control de plazo" },
  { n: 7, nombre: "Liquidación", responsable: "Gerente del proyecto e interventor", accion: "Firmar el acta de liquidación y devolver retenciones", parametroDias: "etapa_dias_max_7" },
  { n: 8, nombre: "Garantías postcontractuales", responsable: "Gerente del proyecto", accion: "Vigilar las pólizas de calidad y estabilidad hasta su vencimiento" },
  { n: 9, nombre: "Archivado", responsable: "Nadie", accion: "Ninguna: relación cerrada" },
];
export const ETIQUETA_TIPO_MODIFICACION: Record<string, string> = {
  adicion: "Adición", otrosi: "Otrosí", prorroga: "Prórroga", suspension: "Suspensión", reinicio: "Reinicio", cesion: "Cesión",
};
export const etapaPorNumero = (n: number): Etapa => ETAPAS.find((e) => e.n === n) ?? ETAPAS[0];

export type Nivel = "rojo" | "ambar" | "verde" | "archivado";
export const ETIQUETA_NIVEL: Record<Nivel, string> = { rojo: "Rojo", ambar: "Ámbar", verde: "Verde", archivado: "Archivado" };

export type PolizaEntrada = {
  amparo: string;
  estado: "activa" | "cumplida";
  vencimiento: string | null;
  valorAsegurado: bigint | null; // centavos
  minimo: bigint | null; // porcentaje × base del amparo, en centavos; null si no se puede calcular
};
export type Compromiso = { asunto: string; fecha: string };
export type DocumentosTercero = { tiene: boolean; vencidos: string[]; porVencer: { tipo: string; dias: number }[] };

export type EntradaContrato = {
  etapa: number;
  fechaEtapa: string; // AAAA-MM-DD en que entró a la etapa
  fechaFin: string | null; // fecha fin vigente (la inicial o la mayor de las prórrogas firmadas); null si falta el dato
  suspendidoDesde?: string | null; // fecha de la última suspensión firmada sin reinicio
  polizas?: PolizaEntrada[]; // si no se informa, no se vigilan
  documentos?: DocumentosTercero | null; // si no se informa, no se vigilan
  compromisos?: Compromiso[]; // compromisos abiertos de las comunicaciones del contrato (con su fecha)
  valor: bigint; // valor del contrato en centavos (2 decimales)
  autorizacionAsamblea: string | null;
  topeSmmlv?: number | null; // tope propio del contratante; si falta, el parámetro general
};

export type ParametrosVigilancia = { smmlv: number; topeSmmlv: number; alertaDias: number; suspensionMaxDias: number; diasMaxEtapa: Record<number, number> };

export function parametrosDeVigilancia(filas: FilaParametro[], proyectoId?: string | null): ParametrosVigilancia {
  const ctx = { proyectoId: proyectoId ?? null, portafolioId: null };
  const diasMaxEtapa: Record<number, number> = {};
  for (const e of ETAPAS) if (e.parametroDias) {
    const d = numeroParametro(filas, e.parametroDias, ctx, NaN);
    if (Number.isFinite(d) && d > 0) diasMaxEtapa[e.n] = d;
  }
  return {
    smmlv: numeroParametro(filas, "smmlv_cop", ctx, 0),
    topeSmmlv: numeroParametro(filas, "tope_asamblea_smmlv", ctx, 600),
    alertaDias: numeroParametro(filas, "alerta_ambar_dias", ctx, 30),
    suspensionMaxDias: numeroParametro(filas, "suspension_max_dias", ctx, 30),
    diasMaxEtapa,
  };
}

// Tope de contratación sin asamblea, en centavos; null si no se conoce el SMMLV.
export function topeAsamblea(p: ParametrosVigilancia, topePropio?: number | null): bigint | null {
  if (!(p.smmlv > 0)) return null;
  return BigInt(Math.round(p.smmlv)) * BigInt(topePropio && topePropio > 0 ? topePropio : p.topeSmmlv) * 100n;
}

// Valor mínimo que debe asegurar una póliza: porcentaje del amparo × base (valor del contrato o del anticipo), en centavos.
export function minimoPoliza(porcentaje: number, base: bigint): bigint {
  return (base * BigInt(Math.round(porcentaje * 100)) + 5_000n) / 10_000n;
}

// Estado de los documentos de un tercero a partir del último documento de cada tipo y su fecha de vencimiento.
export function documentosDelTercero(docs: { tipo: string; vencimiento: string }[], hoy: string, alertaDias: number): DocumentosTercero {
  const vencidos: string[] = [], porVencer: { tipo: string; dias: number }[] = [];
  for (const d of docs) {
    const dias = diasParaVencer(d.vencimiento, hoy);
    if (dias < 0) vencidos.push(d.tipo);
    else if (dias <= alertaDias) porVencer.push({ tipo: d.tipo, dias });
  }
  return { tiene: docs.length > 0, vencidos, porVencer };
}

export type Semaforo = { nivel: Nivel; rojas: string[]; ambar: string[]; accion: string; diasEnEtapa: number };

const plural = (n: number, s: string, p: string) => `${n} ${Math.abs(n) === 1 ? s : p}`;

export function semaforoContrato(c: EntradaContrato, hoy: string, p: ParametrosVigilancia): Semaforo {
  const etapa = etapaPorNumero(c.etapa);
  const diasEnEtapa = Math.max(0, -diasParaVencer(c.fechaEtapa, hoy));
  if (c.etapa === 9) return { nivel: "archivado", rojas: [], ambar: [], accion: etapa.accion, diasEnEtapa };

  const rojas: string[] = [], ambar: string[] = [];
  const max = p.diasMaxEtapa[c.etapa];
  if (max !== undefined && diasEnEtapa > max) rojas.push(`Etapa «${etapa.nombre}» vencida: ${plural(diasEnEtapa, "día", "días")} de ${max} permitidos`);

  const suspendido = !!c.suspendidoDesde;
  if (suspendido) {
    const d = Math.max(0, -diasParaVencer(c.suspendidoDesde as string, hoy));
    if (d > p.suspensionMaxDias) rojas.push(`Suspendido hace ${plural(d, "día", "días")} (máximo ${p.suspensionMaxDias} antes de decidir)`);
    else ambar.push(`Contrato suspendido hace ${plural(d, "día", "días")}`);
  }
  if (c.etapa === 6 && !suspendido) {
    if (c.fechaFin === null) ambar.push("Falta el acta de inicio o el plazo para calcular la fecha fin");
    else {
      const d = diasParaVencer(c.fechaFin, hoy);
      if (d < 0) rojas.push(`Plazo vencido hace ${plural(-d, "día", "días")}`);
      else if (d <= p.alertaDias) ambar.push(d === 0 ? "El plazo vence hoy" : `El plazo vence en ${plural(d, "día", "días")}`);
    }
  }

  if (c.polizas && c.etapa >= 5 && c.etapa <= 8) {
    for (const z of c.polizas) {
      if (z.estado === "cumplida") continue;
      if (z.vencimiento === null) ambar.push(`Póliza «${z.amparo}» sin fecha de vencimiento`);
      else {
        const d = diasParaVencer(z.vencimiento, hoy);
        if (d < 0) rojas.push(`Póliza «${z.amparo}» vencida hace ${plural(-d, "día", "días")}`);
        else if (d <= p.alertaDias) ambar.push(`Póliza «${z.amparo}» vence en ${plural(d, "día", "días")}`);
      }
      if (z.valorAsegurado === null) ambar.push(`Póliza «${z.amparo}» sin valor asegurado`);
      else if (z.minimo !== null && z.valorAsegurado < z.minimo) rojas.push(`Póliza «${z.amparo}» por debajo del mínimo exigido`);
    }
  }

  if (c.documentos && c.etapa >= 1 && c.etapa <= 8) {
    if (!c.documentos.tiene) ambar.push("El contratista no tiene documentos registrados");
    for (const t of c.documentos.vencidos) rojas.push(`Documento del contratista vencido: ${t}`);
    for (const t of c.documentos.porVencer) ambar.push(`Documento del contratista por vencer: ${t.tipo} (${plural(t.dias, "día", "días")})`);
  }

  if (c.compromisos && c.etapa < 9) {
    for (const k of c.compromisos) {
      const d = diasParaVencer(k.fecha, hoy);
      if (d < 0) rojas.push(`Compromiso vencido hace ${plural(-d, "día", "días")}: ${k.asunto}`);
      else if (d <= p.alertaDias) ambar.push(`Compromiso por vencer (${d === 0 ? "hoy" : `en ${plural(d, "día", "días")}`}): ${k.asunto}`);
    }
  }

  const tope = topeAsamblea(p, c.topeSmmlv);
  if (tope !== null && c.etapa >= 3 && c.etapa <= 7 && c.valor > tope && !(c.autorizacionAsamblea ?? "").trim())
    ambar.push(`Supera ${c.topeSmmlv && c.topeSmmlv > 0 ? c.topeSmmlv : p.topeSmmlv} SMMLV sin autorización de asamblea registrada`);

  return { nivel: rojas.length ? "rojo" : ambar.length ? "ambar" : "verde", rojas, ambar, accion: etapa.accion, diasEnEtapa };
}

// Orden de urgencia del tablero: rojo, ámbar, verde, archivado; dentro de cada nivel, el que lleva más tiempo en su etapa.
const PESO: Record<Nivel, number> = { rojo: 0, ambar: 1, verde: 2, archivado: 3 };
export function ordenarPorUrgencia<T extends { semaforo: Semaforo }>(lista: T[]): T[] {
  return [...lista].sort((a, b) => PESO[a.semaforo.nivel] - PESO[b.semaforo.nivel] || b.semaforo.diasEnEtapa - a.semaforo.diasEnEtapa);
}

// Canales de las comunicaciones de un contrato.
export const CANALES: [string, string][] = [["correo", "Correo"], ["reunion", "Reunión"], ["llamada", "Llamada"], ["chat", "Teams / chat"], ["visita_obra", "Visita de obra"], ["comunicacion_escrita", "Comunicación escrita"], ["acta", "Acta"], ["revision_aprobacion", "Revisión / aprobación"]];
