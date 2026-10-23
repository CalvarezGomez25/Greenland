// Actividades: trabajo asignado a personas del proyecto. Funciones puras (sin red) para poder probarlas.

export type EstadoActividad = "por_hacer" | "en_curso" | "bloqueada" | "hecha";
export type PrioridadActividad = "alta" | "media" | "baja";

export const ESTADOS_ACTIVIDAD: EstadoActividad[] = ["por_hacer", "en_curso", "bloqueada", "hecha"];
export const ETIQUETA_ESTADO_ACTIVIDAD: Record<EstadoActividad, string> = {
  por_hacer: "Por hacer", en_curso: "En curso", bloqueada: "Bloqueada", hecha: "Hecha",
};
export const ETIQUETA_PRIORIDAD: Record<PrioridadActividad, string> = { alta: "Alta", media: "Media", baja: "Baja" };
const PESO_PRIORIDAD: Record<PrioridadActividad, number> = { alta: 0, media: 1, baja: 2 };

export type Actividad = {
  id: string;
  proyecto_id: string;
  titulo: string;
  estado: EstadoActividad;
  prioridad: PrioridadActividad;
  fecha_limite: string | null; // AAAA-MM-DD
  responsable_id: string | null;
};

// Tarjeta del tablero: la actividad con lo que la pantalla necesita mostrar y los permisos ya resueltos en el servidor.
export type ItemTablero = Actividad & {
  descripcion: string | null;
  responsable: string | null; // nombre
  riesgo: string | null; // código
  elemento: string | null; // código y nombre de la EDT
  proyecto?: string | null; // «GL-001 · Nombre», solo en «Mi trabajo»
  puedeMover: boolean;
  hrefEditar?: string;
  hrefProyecto?: string;
};

// La misma lista con una actividad en otro estado (el cambio inmediato que se ve al arrastrar).
export function conEstado<T extends Pick<Actividad, "id" | "estado">>(lista: T[], id: string, estado: EstadoActividad): T[] {
  return lista.map((a) => (a.id === id ? { ...a, estado } : a));
}

export const esEstadoActividad = (v: unknown): v is EstadoActividad => ESTADOS_ACTIVIDAD.includes(v as EstadoActividad);

// Fecha de hoy en Colombia (AAAA-MM-DD), igual que la base de datos (hoy_co).
export const hoyColombia = (ahora = new Date()) => ahora.toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

const MS_DIA = 86_400_000;
const aDias = (f: string) => Math.floor(Date.parse(`${f}T00:00:00Z`) / MS_DIA);

// Días que faltan para la fecha límite (negativo: ya pasó).
export function diasParaVencer(fechaLimite: string, hoy: string): number {
  return aDias(fechaLimite) - aDias(hoy);
}

// Vencida = no está hecha y su fecha límite ya pasó. Una actividad que vence hoy todavía no está vencida.
export function estaVencida(a: Pick<Actividad, "estado" | "fecha_limite">, hoy: string): boolean {
  return a.estado !== "hecha" && a.fecha_limite !== null && a.fecha_limite < hoy;
}

// Orden dentro de una columna: primero las vencidas y las de fecha más cercana, luego sin fecha; a igual fecha, por prioridad.
export function ordenarActividades<T extends Pick<Actividad, "fecha_limite" | "prioridad" | "titulo">>(lista: T[]): T[] {
  return [...lista].sort((x, y) => {
    if (x.fecha_limite !== y.fecha_limite) {
      if (x.fecha_limite === null) return 1;
      if (y.fecha_limite === null) return -1;
      return x.fecha_limite < y.fecha_limite ? -1 : 1;
    }
    return PESO_PRIORIDAD[x.prioridad] - PESO_PRIORIDAD[y.prioridad] || x.titulo.localeCompare(y.titulo, "es");
  });
}

// Columnas del tablero.
export function agruparPorEstado<T extends Pick<Actividad, "estado" | "fecha_limite" | "prioridad" | "titulo">>(lista: T[]): Record<EstadoActividad, T[]> {
  const out: Record<EstadoActividad, T[]> = { por_hacer: [], en_curso: [], bloqueada: [], hecha: [] };
  for (const a of lista) out[a.estado].push(a);
  for (const e of ESTADOS_ACTIVIDAD) out[e] = ordenarActividades(out[e]);
  return out;
}

export type GrupoVencimiento = "vencidas" | "esta_semana" | "mas_adelante" | "sin_fecha";
export const ETIQUETA_GRUPO: Record<GrupoVencimiento, string> = {
  vencidas: "Vencidas", esta_semana: "Próximos 7 días", mas_adelante: "Más adelante", sin_fecha: "Sin fecha límite",
};
export const GRUPOS_VENCIMIENTO: GrupoVencimiento[] = ["vencidas", "esta_semana", "mas_adelante", "sin_fecha"];

// «Mi trabajo»: lo pendiente, agrupado por urgencia. Las hechas no se listan.
export function agruparPorVencimiento<T extends Pick<Actividad, "estado" | "fecha_limite" | "prioridad" | "titulo">>(lista: T[], hoy: string): Record<GrupoVencimiento, T[]> {
  const out: Record<GrupoVencimiento, T[]> = { vencidas: [], esta_semana: [], mas_adelante: [], sin_fecha: [] };
  for (const a of lista) {
    if (a.estado === "hecha") continue;
    if (a.fecha_limite === null) out.sin_fecha.push(a);
    else if (a.fecha_limite < hoy) out.vencidas.push(a);
    else if (diasParaVencer(a.fecha_limite, hoy) <= 7) out.esta_semana.push(a);
    else out.mas_adelante.push(a);
  }
  for (const g of GRUPOS_VENCIMIENTO) out[g] = ordenarActividades(out[g]);
  return out;
}

// Texto corto del plazo: «Vencida hace 3 días», «Vence hoy», «Vence mañana», «Vence en 5 días».
export function textoPlazo(fechaLimite: string, hoy: string): string {
  const d = diasParaVencer(fechaLimite, hoy);
  if (d < 0) return `Vencida hace ${-d} ${-d === 1 ? "día" : "días"}`;
  if (d === 0) return "Vence hoy";
  if (d === 1) return "Vence mañana";
  return `Vence en ${d} días`;
}

// Línea de tiempo de «Mi trabajo»: un hito por fecha límite de lo pendiente, desde la actividad más atrasada
// hasta la más lejana. «Hoy» siempre está dentro del horizonte.
export type Hito<T> = { fecha: string; dias: number; items: T[]; x: number };
export type LineaDeTiempo<T> = { hitos: Hito<T>[]; xHoy: number; ancho: number; vencidas: number; proximos: number };

// Posiciones en píxeles: proporcionales a los días, pero con una separación mínima entre hitos para que los rótulos se lean.
// Entre dos hitos la distancia nunca es menor que `separacion`; por eso la escala es aproximada y lo que manda es el orden.
export function construirLineaDeTiempo<T extends Pick<Actividad, "estado" | "fecha_limite">>(
  lista: T[], hoy: string, opciones: { anchoMinimo?: number; separacion?: number; margen?: number } = {},
): LineaDeTiempo<T> {
  const { anchoMinimo = 640, separacion = 120, margen = 70 } = opciones;
  const porFecha = new Map<string, T[]>();
  for (const a of lista) {
    if (a.estado === "hecha" || a.fecha_limite === null) continue;
    porFecha.set(a.fecha_limite, [...(porFecha.get(a.fecha_limite) ?? []), a]);
  }
  const fechas = [...porFecha.keys()].sort();
  const inicio = fechas[0] !== undefined && fechas[0] < hoy ? fechas[0] : hoy;
  const fin = fechas.length > 0 && fechas[fechas.length - 1] > hoy ? fechas[fechas.length - 1] : hoy;
  const total = Math.max(diasParaVencer(fin, inicio), 1);

  const ancho = Math.max(anchoMinimo, (fechas.length + 1) * separacion + 2 * margen);
  const util = ancho - 2 * margen;
  const lineal = (f: string) => margen + (diasParaVencer(f, inicio) / total) * util;

  // Puntos a ubicar: los hitos y «hoy», en orden de fecha (si coinciden, «hoy» va con el hito).
  const x = new Map<string, number>();
  let previo = -Infinity;
  for (const f of [...new Set([...fechas, hoy])].sort()) {
    const pos = Math.max(lineal(f), previo + (f === hoy && porFecha.has(hoy) ? 0 : separacion));
    x.set(f, pos);
    previo = pos;
  }
  const hitos = fechas.map((f) => ({ fecha: f, dias: diasParaVencer(f, hoy), items: porFecha.get(f)!, x: x.get(f)! }));
  const ultimo = Math.max(...x.values());
  return {
    hitos,
    xHoy: x.get(hoy)!,
    ancho: Math.max(ancho, ultimo + margen),
    vencidas: hitos.filter((h) => h.dias < 0).reduce((n, h) => n + h.items.length, 0),
    proximos: hitos.filter((h) => h.dias >= 0).reduce((n, h) => n + h.items.length, 0),
  };
}
