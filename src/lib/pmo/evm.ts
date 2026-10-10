// Valor ganado (EVM). Dinero en bigint con 2 decimales ("centavos"): aritmética exacta.
// Fórmulas del libro (especificación, módulo G).

import { dividirRedondeado } from "../presupuesto/dinero";

export type EntradaEvm = { bac: bigint; pv: bigint; ev: bigint; ac: bigint };

export type ResultadoEvm = {
  spi: number | null;
  cpi: number | null;
  sv: bigint;
  cv: bigint;
  eac: bigint | null; // BAC / CPI
  etc: bigint | null; // EAC − AC
  tcpi: number | null; // (BAC − EV) / (BAC − AC)
  vac: bigint | null; // BAC − EAC
  avanceFisico: number | null; // EV / BAC (%)
  avancePlan: number | null; // PV / BAC (%)
  avanceFinanciero: number | null; // AC / BAC (%)
};

// a / b con 4 decimales; null si el divisor no es positivo.
export function razon(a: bigint, b: bigint): number | null {
  if (b <= 0n) return null;
  return Number(dividirRedondeado(a * 10_000n, b)) / 10_000;
}

const porcentaje = (a: bigint, b: bigint) => {
  const r = razon(a * 100n, b);
  return r === null ? null : Math.round(r * 100) / 100;
};

export function calcularEvm({ bac, pv, ev, ac }: EntradaEvm): ResultadoEvm {
  const spi = razon(ev, pv);
  const cpi = razon(ev, ac);
  // EAC = BAC / CPI = BAC × AC / EV  (exacto, sin pasar por el índice redondeado)
  const eac = ev > 0n && ac > 0n ? dividirRedondeado(bac * ac, ev) : null;
  return {
    spi,
    cpi,
    sv: ev - pv,
    cv: ev - ac,
    eac,
    etc: eac === null ? null : eac - ac,
    tcpi: razon(bac - ev, bac - ac),
    vac: eac === null ? null : bac - eac,
    avanceFisico: porcentaje(ev, bac),
    avancePlan: porcentaje(pv, bac),
    avanceFinanciero: porcentaje(ac, bac),
  };
}

// Portafolio: se suman BAC, PV, EV y AC y luego se calculan los índices.
// NO se promedian los índices de cada proyecto (caso 13.4).
export function sumarEvm(lista: EntradaEvm[]): EntradaEvm {
  return lista.reduce(
    (t, x) => ({ bac: t.bac + x.bac, pv: t.pv + x.pv, ev: t.ev + x.ev, ac: t.ac + x.ac }),
    { bac: 0n, pv: 0n, ev: 0n, ac: 0n },
  );
}
