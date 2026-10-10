// Contratos y pagos (especificación, módulo M). Dinero en bigint con 2 decimales ("centavos").
// El cálculo oficial de cada acta lo hace la base de datos al radicarla; esta copia sirve para
// mostrar los resúmenes y para probar el caso 13.1 en cada cambio del código.

import { dividirRedondeado } from "../presupuesto/dinero";

export type ContratoBase = { valor: bigint; anticipoPct: number; anticipoValor: bigint; retencionPct: number };
export type ActaBase = { valorBruto: bigint; amortizacion: bigint; retencion: bigint; neto: bigint };

export const TIPOS_CONTRATO = ["obra", "interventoria", "consultoria", "suministro", "otro"] as const;
export const ETIQUETA_TIPO_CONTRATO: Record<string, string> = { obra: "Obra", interventoria: "Interventoría", consultoria: "Consultoría", suministro: "Suministro", otro: "Otro" };
export const ETIQUETA_ESTADO_ACTA: Record<string, string> = {
  radicada: "Radicada", en_revision_interventoria: "En revisión de interventoría", con_observaciones: "Con observaciones", aprobada_pago: "Aprobada para pago",
};

const pct100 = (pct: number) => BigInt(Math.round(pct * 100)); // porcentaje con 2 decimales como entero

// Valores de una acta nueva: amortización = mín(anticipo pendiente, bruto × anticipo %); retención = bruto × retención %.
export function calcularActa(contrato: ContratoBase, previas: ActaBase[], bruto: bigint): ActaBase {
  const amortizado = previas.reduce((s, a) => s + a.amortizacion, 0n);
  const pendiente = contrato.anticipoValor > amortizado ? contrato.anticipoValor - amortizado : 0n;
  const porAnticipo = dividirRedondeado(bruto * pct100(contrato.anticipoPct), 10_000n);
  const amortizacion = porAnticipo < pendiente ? porAnticipo : pendiente;
  const retencion = dividirRedondeado(bruto * pct100(contrato.retencionPct), 10_000n);
  return { valorBruto: bruto, amortizacion, retencion, neto: bruto - amortizacion - retencion };
}

export type ResumenContrato = {
  facturado: bigint; amortizado: bigint; retenido: bigint; neto: bigint;
  anticipoPendiente: bigint;
  desembolsado: bigint; // anticipo + netos (+ retención, si ya fue liberada)
  saldoPorEjecutar: bigint;
  ejecutadoPct: number | null; // facturado / valor
  completo: boolean; // facturado el 100 %: permite liberar la retención
};

export function resumenContrato(c: ContratoBase, actas: ActaBase[], retencionLiberada: boolean): ResumenContrato {
  const facturado = actas.reduce((s, a) => s + a.valorBruto, 0n);
  const amortizado = actas.reduce((s, a) => s + a.amortizacion, 0n);
  const retenido = actas.reduce((s, a) => s + a.retencion, 0n);
  const neto = actas.reduce((s, a) => s + a.neto, 0n);
  return {
    facturado, amortizado, retenido, neto,
    anticipoPendiente: c.anticipoValor > amortizado ? c.anticipoValor - amortizado : 0n,
    desembolsado: c.anticipoValor + neto + (retencionLiberada ? retenido : 0n),
    saldoPorEjecutar: c.valor - facturado,
    ejecutadoPct: c.valor > 0n ? Number(dividirRedondeado(facturado * 10_000n, c.valor)) / 100 : null,
    completo: c.valor > 0n && facturado >= c.valor,
  };
}
