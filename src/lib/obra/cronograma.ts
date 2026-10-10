// Cronograma y avance físico (especificación, módulo K).
//
//  - Avance físico = Σ (peso × avance de la tarea / 100).
//  - Planificado a las k semanas transcurridas = Σ peso × mínimo(1, máximo(0, (k − (inicio − 1)) / duración)).
//    (semana_inicio = 1 es la primera semana del proyecto).
//  - Avance verificado: con el parámetro ev_usa_avance_verificado, cada tarea usa el verificado por la
//    interventoría si existe y, si no, el reportado.
// El peso se guarda con 4 decimales y el avance con 2: la suma es exacta (enteros grandes).

import { aEscalado } from "../presupuesto/dinero";

export type Tarea = {
  id: string;
  nombre: string;
  semana_inicio: number;
  duracion_semanas: number;
  peso_pct: number | string;
  avance_pct: number | string;
  avance_verificado_pct: number | string | null;
  orden?: number;
};

const peso = (t: Tarea) => aEscalado(String(t.peso_pct), 4);
const avance = (v: number | string) => aEscalado(String(v), 2);

const aPorcentaje = (suma: bigint): number => Math.round(Number(suma) / 1e6) / 100; // suma en escala 1e8 → % con 2 decimales

export function sumaPesos(tareas: Tarea[]): number {
  return Number(tareas.reduce((s, t) => s + peso(t), 0n)) / 1e4;
}

export type AvanceFisico = { reportado: number; verificado: number; usado: number; diferencia: number; hayVerificado: boolean };

export function avanceFisico(tareas: Tarea[], usaVerificado = true): AvanceFisico {
  let rep = 0n, ver = 0n;
  let hayVerificado = false;
  for (const t of tareas) {
    const p = peso(t);
    const a = avance(t.avance_pct);
    const v = t.avance_verificado_pct === null ? a : avance(t.avance_verificado_pct);
    if (t.avance_verificado_pct !== null) hayVerificado = true;
    rep += p * a;
    ver += p * v;
  }
  const reportado = aPorcentaje(rep);
  const verificado = aPorcentaje(ver);
  return { reportado, verificado, usado: usaVerificado ? verificado : reportado, diferencia: Math.round((reportado - verificado) * 100) / 100, hayVerificado };
}

// k = semanas transcurridas (puede ser fraccionario) desde el inicio del proyecto.
export function semanasTranscurridas(fechaInicio: string, corte: string): number {
  const ms = (f: string) => { const [a, m, d] = f.split("-").map(Number); return Date.UTC(a, m - 1, d); };
  return Math.max(0, (ms(corte) - ms(fechaInicio)) / 86_400_000 / 7);
}

// Semanas desde el inicio hasta el fin del mes m (el mes 1 termina un mes calendario después del inicio).
export function semanasHastaMes(fechaInicio: string, mes: number): number {
  const [a, m, d] = fechaInicio.split("-").map(Number);
  const fin = Date.UTC(a, m - 1 + mes, d);
  return Math.max(0, (fin - Date.UTC(a, m - 1, d)) / 86_400_000 / 7);
}

export function planificadoPct(tareas: Tarea[], k: number): number {
  let s = 0;
  for (const t of tareas) {
    const frac = Math.min(1, Math.max(0, (k - (t.semana_inicio - 1)) / t.duracion_semanas));
    s += Number(t.peso_pct) * frac;
  }
  return Math.round(s * 100) / 100;
}

// Semana final del cronograma (para dimensionar el Gantt).
export const semanaFinal = (tareas: Tarea[]) => tareas.reduce((m, t) => Math.max(m, t.semana_inicio + t.duracion_semanas - 1), 0);

// Planificado acumulado en pesos (escala 6) a partir del cronograma: costoTotal × planificado %.
export function planificadoDesdeCronograma(costoTotal: bigint, tareas: Tarea[], fechaInicio: string): (mes: number) => bigint {
  return (mes: number) => {
    const pct = BigInt(Math.round(planificadoPct(tareas, semanasHastaMes(fechaInicio, mes)) * 100)); // % × 100
    return (costoTotal * pct) / 10_000n;
  };
}
