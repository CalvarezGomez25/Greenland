// Control de costos por cortes: cada medición de valor ganado es un «corte». Para cada uno se muestra lo invertido,
// lo que falta por invertir y lo proyectado (EAC calculado = BAC × AC / EV), y cómo se movió frente al corte anterior
// y frente a la línea base de costo (BAC). Dinero en bigint con 2 decimales (igual que las mediciones).
// El «proyectado» es siempre el EAC calculado, no una estimación escrita a mano (supuesto S25).

import { calcularEvm } from "./evm";
import { dividirRedondeado } from "../presupuesto/dinero";

export type MedicionCorte = { fecha: string; bac: bigint; pv: bigint; ev: bigint; ac: bigint; origen: string };

export type Corte = {
  fecha: string; // AAAA-MM-DD
  origen: string;
  bac: bigint; // línea base de costo vigente en el corte
  invertido: bigint; // AC
  proyectado: bigint | null; // EAC; null si aún no hay avance o gasto para proyectar
  porInvertir: bigint | null; // EAC − AC (nunca negativo)
  pctInvertido: number | null; // AC / EAC, un decimal (0–100)
  cpi: number | null;
  invertidoEnPeriodo: bigint | null; // AC − AC del corte anterior
  variacionProyectado: bigint | null; // EAC − EAC del corte anterior (positivo: el proyecto se encarece)
  variacionBase: bigint | null; // EAC − BAC (positivo: sobrecosto proyectado frente a la línea base)
  cambioBac: bigint | null; // BAC − BAC del corte anterior (cambios aprobados)
};

export function construirCortes(mediciones: MedicionCorte[]): Corte[] {
  const orden = [...mediciones].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const cortes: Corte[] = [];
  for (const m of orden) {
    const ant = cortes[cortes.length - 1];
    const r = calcularEvm({ bac: m.bac, pv: m.pv, ev: m.ev, ac: m.ac });
    const proyectado = r.eac;
    cortes.push({
      fecha: m.fecha,
      origen: m.origen,
      bac: m.bac,
      invertido: m.ac,
      proyectado,
      porInvertir: proyectado === null ? null : proyectado > m.ac ? proyectado - m.ac : 0n,
      pctInvertido: proyectado !== null && proyectado > 0n ? Number(dividirRedondeado((m.ac * 1000n), proyectado)) / 10 : null,
      cpi: r.cpi,
      invertidoEnPeriodo: ant ? m.ac - ant.invertido : null,
      variacionProyectado: ant && ant.proyectado !== null && proyectado !== null ? proyectado - ant.proyectado : null,
      variacionBase: proyectado === null ? null : proyectado - m.bac,
      cambioBac: ant ? m.bac - ant.bac : null,
    });
  }
  return cortes;
}
