// Control de costos por capítulo (fase 2): lo mismo que el control por cortes del proyecto, pero para cada capítulo.
//  - Presupuesto: el del capítulo con su parte de indirectos (ver balance.ts).
//  - Avance físico: promedio de las tareas del cronograma ligadas al capítulo, ponderado por su peso.
//  - Valor ganado (EV) = presupuesto × avance. Invertido (AC) = facturado asignado al capítulo (actas de los contratos aprobados).
//  - Proyectado (EAC) = presupuesto × AC / EV, igual que en el proyecto; sin avance o sin facturado no hay proyección.
// Funciones puras (sin red). Montos en escala 6 (ver dinero.ts); avance y peso vienen de numeric(5,2) y numeric(7,4).

import type { FilaBalance } from "./balance";
import { dividirRedondeado } from "./dinero";

export type TareaCapitulo = { capituloId: string | null; peso: bigint; avance: bigint }; // peso escala 4, avance escala 2 (% con 2 decimales)

export type FilaProyeccion = {
  id: string;
  codigo: string;
  nombre: string;
  presupuesto: bigint;
  avance: number | null; // % físico, un decimal; null si el capítulo no tiene tareas con peso
  ev: bigint | null;
  invertido: bigint; // facturado asignado
  contratado: bigint;
  proyectado: bigint | null; // EAC
  porInvertir: bigint | null;
  cpi: number | null;
  sobrePresupuesto: bigint | null; // EAC − presupuesto (positivo: se proyecta un sobrecosto)
  sobreContrato: bigint | null; // EAC − contratado, solo si hay contrato asignado (positivo: lo contratado no alcanzaría)
};

export function proyectarCapitulos(capitulos: FilaBalance[], tareas: TareaCapitulo[]): FilaProyeccion[] {
  return capitulos.map((c) => {
    const propias = tareas.filter((t) => t.capituloId === c.id && t.peso > 0n);
    const pesoTotal = propias.reduce((s, t) => s + t.peso, 0n);
    const ponderado = propias.reduce((s, t) => s + t.peso * t.avance, 0n); // escala 6 (peso 4 + avance 2)
    const tieneAvance = pesoTotal > 0n;
    // avance como fracción: ponderado / (pesoTotal × 100 por ciento × 100 por la escala del avance)
    const ev = tieneAvance ? dividirRedondeado(c.presupuesto * ponderado, pesoTotal * 10_000n) : null;
    const avance = tieneAvance ? Number(dividirRedondeado(ponderado * 10n, pesoTotal * 100n)) / 10 : null;
    const proyectado = ev !== null && ev > 0n && c.facturado > 0n ? dividirRedondeado(c.presupuesto * c.facturado, ev) : null;
    return {
      id: c.id, codigo: c.codigo, nombre: c.nombre, presupuesto: c.presupuesto, avance, ev,
      invertido: c.facturado, contratado: c.contratado, proyectado,
      porInvertir: proyectado === null ? null : proyectado > c.facturado ? proyectado - c.facturado : 0n,
      cpi: ev !== null && c.facturado > 0n ? Number(dividirRedondeado(ev * 10_000n, c.facturado)) / 10_000 : null,
      sobrePresupuesto: proyectado === null ? null : proyectado - c.presupuesto,
      sobreContrato: proyectado === null || c.contratado <= 0n ? null : proyectado - c.contratado,
    };
  });
}
