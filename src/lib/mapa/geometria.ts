// Geometría del mapa de proceso: posiciones de los módulos por carril y etapa, y las curvas de los flujos de datos.
// Son funciones puras (sin pantalla) para poder probarlas.

import { CARRILES, FLUJOS, ESENCIALES, MODULOS_MAPA, type CarrilId, type Flujo, type ModuloMapa } from "./datos";

export type Detalle = "full" | "brief";
export type Estilo = "car" | "met";
export type Rect = { x: number; y: number; w: number; h: number };
export type Cfg = { lab: number; W: number; top: number; spineH: number; afterSpine: number; nodeH: number; gap: number; laneGap: number };
export type Disposicion = {
  cfg: Cfg; colW: number; end: number; pad: number;
  lanes: Record<CarrilId, { y: number; h: number; rows: number }>;
  rect: Record<string, Rect>; row: Record<string, number>;
};

export const modulosVisibles = (det: Detalle): ModuloMapa[] => (det === "brief" ? MODULOS_MAPA.filter((m) => ESENCIALES.has(m.id)) : MODULOS_MAPA);
export const flujosVisibles = (det: Detalle): Flujo[] => {
  const ids = new Set(modulosVisibles(det).map((m) => m.id));
  return FLUJOS.filter((f) => ids.has(f[0]) && ids.has(f[1]));
};

// Medidas de cada estilo y nivel de detalle (en píxeles del lienzo; la pantalla lo escala al ancho disponible).
export function configuracion(est: Estilo, det: Detalle): Cfg {
  const brief = det === "brief";
  return est === "car"
    ? { lab: 128, W: 980, top: 6, spineH: brief ? 50 : 62, afterSpine: 12, nodeH: brief ? 50 : 72, gap: 8, laneGap: 10 }
    : { lab: 150, W: 980, top: 6, spineH: brief ? 50 : 62, afterSpine: 14, nodeH: brief ? 62 : 78, gap: 6, laneGap: 6 };
}

// En la versión completa se respetan las filas definidas; en la resumida se reacomodan al quitar módulos.
export function disponer(cfg: Cfg, det: Detalle): Disposicion {
  const ms = modulosVisibles(det);
  const pad = 6;
  const colW = (cfg.W - cfg.lab - 8) / 6;
  const row: Record<string, number> = {};
  CARRILES.forEach((l) => {
    const ls = ms.filter((m) => m.l === l.id).sort((x, y) => x.row - y.row || x.a - y.a);
    const puestos: { a: number; b: number; r: number }[] = [];
    ls.forEach((m) => {
      let r = det === "full" ? m.row : 0;
      if (det !== "full") while (puestos.some((p) => p.r === r && !(m.b < p.a || m.a > p.b))) r++;
      puestos.push({ a: m.a, b: m.b, r });
      row[m.id] = r;
    });
  });
  let y = cfg.top + cfg.spineH + cfg.afterSpine;
  const lanes = {} as Disposicion["lanes"];
  CARRILES.forEach((l) => {
    const rows = Math.max(...ms.filter((m) => m.l === l.id).map((m) => row[m.id])) + 1;
    const h = rows * cfg.nodeH + (rows - 1) * cfg.gap + 14;
    lanes[l.id] = { y, h, rows };
    y += h + cfg.laneGap;
  });
  const rect: Record<string, Rect> = {};
  ms.forEach((m) => {
    rect[m.id] = { x: cfg.lab + (m.a - 1) * colW + pad, y: lanes[m.l].y + 7 + row[m.id] * (cfg.nodeH + cfg.gap), w: (m.b - m.a + 1) * colW - pad * 2, h: cfg.nodeH };
  });
  return { cfg, colW, end: y - cfg.laneGap, pad, lanes, rect, row };
}

// Estación del mapa de metro: círculo si el módulo se usa en una etapa, cápsula si abarca varias.
export function estacion(d: Disposicion, m: ModuloMapa): Rect & { sx: number; ex: number; ty: number } {
  const r = d.rect[m.id];
  const ty = r.y + 14;
  const sx = r.x + 16;
  const ex = m.b > m.a ? r.x + r.w - 16 : sx;
  return { x: sx - 10, y: ty - 10, w: ex - sx + 20, h: 20, sx, ex, ty };
}

// Curva de un flujo entre dos piezas y el mejor punto para su número (en un tramo libre, fuera de los módulos).
export function curva(A: Rect, B: Rect, ocupados: Rect[]): { d: string; mx: number; my: number } {
  const ac = { x: A.x + A.w / 2, y: A.y + A.h / 2 };
  const bc = { x: B.x + B.w / 2, y: B.y + B.h / 2 };
  let p0, p1, c0, c1;
  if (B.x >= A.x + A.w - 2) {
    p0 = { x: A.x + A.w, y: ac.y }; p1 = { x: B.x, y: bc.y };
    const d = Math.max(30, (p1.x - p0.x) / 2);
    c0 = { x: p0.x + d, y: p0.y }; c1 = { x: p1.x - d, y: p1.y };
  } else if (A.x >= B.x + B.w - 2) {
    p0 = { x: A.x, y: ac.y }; p1 = { x: B.x + B.w, y: bc.y };
    const d = Math.max(30, (p0.x - p1.x) / 2);
    c0 = { x: p0.x - d, y: p0.y }; c1 = { x: p1.x + d, y: p1.y };
  } else {
    const lo = Math.max(A.x, B.x), hi = Math.min(A.x + A.w, B.x + B.w);
    const x = (lo + hi) / 2;
    if (B.y > A.y) { p0 = { x, y: A.y + A.h }; p1 = { x, y: B.y }; } else { p0 = { x, y: A.y }; p1 = { x, y: B.y + B.h }; }
    const d = Math.max(26, Math.abs(p1.y - p0.y) / 2);
    const s = p1.y > p0.y ? d : -d;
    c0 = { x: p0.x, y: p0.y + s }; c1 = { x: p1.x, y: p1.y - s };
  }
  const en = (t: number) => {
    const u = 1 - t;
    return { x: u ** 3 * p0.x + 3 * u * u * t * c0.x + 3 * u * t * t * c1.x + t ** 3 * p1.x, y: u ** 3 * p0.y + 3 * u * u * t * c0.y + 3 * u * t * t * c1.y + t ** 3 * p1.y };
  };
  const dentro = (q: { x: number; y: number }) => ocupados.some((r) => q.x > r.x && q.x < r.x + r.w && q.y > r.y && q.y < r.y + r.h);
  let mejor = en(0.5);
  if (dentro(mejor)) {
    for (let k = 1; k <= 40; k++) {
      const a = en(0.5 + k * 0.0125), b = en(0.5 - k * 0.0125);
      if (!dentro(a)) { mejor = a; break; }
      if (!dentro(b)) { mejor = b; break; }
    }
  }
  return { d: `M${p0.x},${p0.y} C${c0.x},${c0.y} ${c1.x},${c1.y} ${p1.x},${p1.y}`, mx: mejor.x, my: mejor.y };
}
