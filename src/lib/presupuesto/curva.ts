// Curva S y avance financiero.
//
// Planificado: mientras no exista el cronograma (Hito 3) se usa la distribución teórica
// 3t² − 2t³, con t = mes / duración. Se calcula con fracciones exactas:
//   3t² − 2t³ = (3·k²·n − 2·k³) / n³   (k = mes, n = duración)
// Real: gasto acumulado mes a mes. Un mes sin registro cuenta como cero y se avisa.
//
// El avance financiero se mide sobre el COSTO TOTAL (directo + adicionales), no solo el directo.
// Todos los montos están en escala 6 (ver dinero.ts).

import { ESCALA, dividirRedondeado, porcentajeDe } from "./dinero";

export function planificadoAcumulado(costoTotal: bigint, mes: number, duracion: number): bigint {
  if (!Number.isInteger(duracion) || duracion < 1) {
    throw new RangeError("La duración debe ser un número entero de meses mayor o igual a 1.");
  }
  const k = BigInt(Math.min(Math.max(Math.trunc(mes), 0), duracion));
  const n = BigInt(duracion);
  return dividirRedondeado(costoTotal * (3n * k * k * n - 2n * k * k * k), n * n * n);
}

// Gasto de la base de datos (escala 2, en pesos) → monto interno (escala 6).
export const gastoAMonto = (gastoEscala2: bigint): bigint =>
  gastoEscala2 * 10n ** BigInt(ESCALA.monto - ESCALA.precio);

export type PuntoCurva = {
  mes: number;
  planificado: bigint;
  real: bigint | null; // null después del último mes con registro
};

export type SerieCurva = {
  puntos: PuntoCurva[];
  ultimoMes: number; // último mes con gasto registrado (0 si no hay)
  mesesSinRegistro: number[]; // meses anteriores al último sin dato
  gastadoALaFecha: bigint;
};

export function serieCurvaS(entrada: {
  costoTotal: bigint;
  duracion: number;
  gastoPorMes: Map<number, bigint>; // mes → monto (escala 6)
  planificado?: (mes: number) => bigint; // planificado acumulado desde el cronograma; sin él, 3t² − 2t³
}): SerieCurva {
  const { costoTotal, duracion, gastoPorMes } = entrada;
  const mesesConDato = [...gastoPorMes.keys()].filter((m) => m >= 1);
  const ultimoMes = mesesConDato.length ? Math.max(...mesesConDato) : 0;
  const ultimoEjeX = Math.max(duracion, ultimoMes);

  const puntos: PuntoCurva[] = [];
  const mesesSinRegistro: number[] = [];
  let acumulado = 0n;
  for (let mes = 0; mes <= ultimoEjeX; mes++) {
    if (mes >= 1 && mes <= ultimoMes) {
      const gasto = gastoPorMes.get(mes);
      if (gasto === undefined) mesesSinRegistro.push(mes);
      acumulado += gasto ?? 0n;
    }
    puntos.push({
      mes,
      planificado: entrada.planificado ? entrada.planificado(mes) : planificadoAcumulado(costoTotal, mes, duracion),
      real: mes <= ultimoMes ? acumulado : null,
    });
  }
  return { puntos, ultimoMes, mesesSinRegistro, gastadoALaFecha: acumulado };
}

export type Indicadores = {
  costoDirecto: bigint;
  costoTotal: bigint;
  gastadoALaFecha: bigint;
  mesDeCorte: number;
  planificadoALaFecha: bigint;
  avanceFinanciero: number | null; // % del costo total gastado
  desviacion: number | null; // % del gasto frente al planificado (positivo = gasta de más)
  mesesSinRegistro: number[];
};

export function calcularIndicadores(entrada: {
  costoDirecto: bigint;
  costoTotal: bigint;
  duracion: number;
  gastoPorMes: Map<number, bigint>;
  planificado?: (mes: number) => bigint;
}): Indicadores {
  const serie = serieCurvaS(entrada);
  const planificado = entrada.planificado
    ? entrada.planificado(serie.ultimoMes)
    : planificadoAcumulado(entrada.costoTotal, serie.ultimoMes, entrada.duracion);
  return {
    costoDirecto: entrada.costoDirecto,
    costoTotal: entrada.costoTotal,
    gastadoALaFecha: serie.gastadoALaFecha,
    mesDeCorte: serie.ultimoMes,
    planificadoALaFecha: planificado,
    avanceFinanciero: porcentajeDe(serie.gastadoALaFecha, entrada.costoTotal),
    desviacion: porcentajeDe(serie.gastadoALaFecha - planificado, planificado),
    mesesSinRegistro: serie.mesesSinRegistro,
  };
}
