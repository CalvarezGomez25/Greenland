// Bitácora de obra (especificación, módulo L): etiquetas y resumen para el nivel N1 del proyecto.

export const CLIMAS: [string, string][] = [["soleado", "Soleado"], ["nublado", "Nublado"], ["lluvia_leve", "Lluvia leve"], ["lluvia_fuerte", "Lluvia fuerte"], ["tormenta", "Tormenta"]];
export const CAUSAS_RETRASO: [string, string][] = [["clima", "Clima"], ["material", "Material"], ["personal", "Personal"], ["diseno", "Diseño"], ["cliente", "Cliente"], ["otra", "Otra"]];
export const TIPOS_INCIDENTE: [string, string][] = [["accidente", "Accidente"], ["casi_accidente", "Casi accidente"], ["condicion_insegura", "Condición insegura"]];
export const MAX_FOTOS = 5;

export const etiqueta = (lista: [string, string][], v: string | null) => lista.find(([k]) => k === v)?.[1] ?? "—";

export type EntradaResumen = {
  fecha: string;
  es_interventoria: boolean;
  horas_perdidas_total: number | string;
  retraso_causa: string | null;
  incidente_tipo: string | null;
};

export type ResumenBitacora = {
  entradas: number;
  horasPerdidas: number;
  retrasos: number;
  incidentes: number;
  accidentes: number;
  ultimaFecha: string | null;
};

// Horas perdidas = horas por clima + horas de retrasos que no sean por clima (ya calculado por entrada).
// Las entradas de la interventoría no cuentan como avance ni como horas del supervisor.
export function resumenBitacora(entradas: EntradaResumen[]): ResumenBitacora {
  const propias = entradas.filter((e) => !e.es_interventoria);
  return {
    entradas: propias.length,
    horasPerdidas: Math.round(propias.reduce((s, e) => s + Number(e.horas_perdidas_total), 0) * 10) / 10,
    retrasos: propias.filter((e) => e.retraso_causa !== null).length,
    incidentes: propias.filter((e) => e.incidente_tipo !== null).length,
    accidentes: propias.filter((e) => e.incidente_tipo === "accidente").length,
    ultimaFecha: propias.reduce<string | null>((m, e) => (m === null || e.fecha > m ? e.fecha : m), null),
  };
}
