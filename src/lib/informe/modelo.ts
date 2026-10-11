// Informe gerencial de una página: modelo de datos y armado de los «puntos principales».
// Son funciones puras (sin red ni base de datos) para poder probarlas; la lectura está en datos.ts.
import type { Color, NivelRiesgo } from "../pmo/semaforo";

export type DimensionesInforme = { general: Color | null; spi: Color | null; cpi: Color | null; riesgos: Color | null; cambios: Color };

export type InformeProyecto = {
  generado: string; // AAAA-MM-DD
  proyecto: {
    id: string; nombre: string; codigo: string | null; cliente: string | null; ubicacion: string | null;
    fase: string; estado: string; inicio: string | null; duracionMeses: number | null; gerente: string | null;
  };
  semaforo: DimensionesInforme;
  corteEvm: string | null;
  spi: number | null;
  cpi: number | null;
  avanceFisico: number | null;
  avancePlan: number | null;
  avanceFinanciero: number | null;
  // Montos en pesos (COP). null = aún no hay medición de valor ganado.
  bac: number | null; pv: number | null; ev: number | null; ac: number | null; eac: number | null;
  riesgos: {
    activos: number; criticos: number; altos: number; medios: number; bajos: number;
    principales: { codigo: string; frente: string | null; descripcion: string; nivel: NivelRiesgo; score: number; responsable: string | null }[];
  };
  cambios: { pendientes: number; criticos: number; lista: { codigo: string; descripcion: string; estado: string; impactoCosto: number; nivel: string | null }[] };
  hitos: { vencidos: { nombre: string; fecha: string }[]; proximos: { nombre: string; fecha: string }[] };
  reporte: { semana: number; anio: number; estado: Color; logros: string | null; alertas: string | null; decisiones: string | null } | null;
  decisiones: { tipo: string; detalle: string }[];
};

export const ETIQUETA_NIVEL: Record<NivelRiesgo, string> = { critico: "Crítico", alto: "Alto", medio: "Medio", bajo: "Bajo" };
const ETIQUETA_COLOR: Record<Color, string> = { verde: "Verde", amarillo: "Amarillo", rojo: "Rojo" };

const num2 = (n: number) => n.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n: number) => `${n.toLocaleString("es-CO", { maximumFractionDigits: 1 })} %`;

// Pesos con abreviatura para espacios cortos: 1.234.500.000 → "$ 1.234,5 M" ; 850.000 → "$ 850.000".
export function pesosCorto(n: number | null): string {
  if (n === null) return "—";
  const a = Math.abs(n);
  const signo = n < 0 ? "-" : "";
  if (a >= 1_000_000_000) return `${signo}$ ${(a / 1_000_000).toLocaleString("es-CO", { maximumFractionDigits: 0 })} M`;
  if (a >= 1_000_000) return `${signo}$ ${(a / 1_000_000).toLocaleString("es-CO", { maximumFractionDigits: 1 })} M`;
  return `${signo}$ ${Math.round(a).toLocaleString("es-CO")}`;
}

export function fechaCorta(iso: string | null): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${Number(m[3])} ${meses[Number(m[2]) - 1]} ${m[1]}`;
}

// Qué dimensiones del semáforo explican el estado general (las que están en el color general).
export function causasSemaforo(i: InformeProyecto): string[] {
  const g = i.semaforo.general;
  if (!g || g === "verde") return [];
  const causas: string[] = [];
  if (i.semaforo.spi === g) causas.push(`cronograma (SPI ${i.spi === null ? "—" : num2(i.spi)})`);
  if (i.semaforo.cpi === g) causas.push(`costo (CPI ${i.cpi === null ? "—" : num2(i.cpi)})`);
  if (i.semaforo.riesgos === g) causas.push(g === "rojo" ? `${i.riesgos.criticos} riesgo(s) crítico(s) activo(s)` : "riesgos altos o medios activos");
  if (i.semaforo.cambios === g) causas.push(g === "rojo" ? `${i.cambios.criticos} cambio(s) crítico(s) pendiente(s)` : `${i.cambios.pendientes} cambio(s) pendiente(s)`);
  return causas;
}

// Puntos principales: los usa el cuerpo del correo y el recuadro «Lectura rápida» del informe.
// Solo dicen lo que los datos muestran; no interpretan ni inventan.
export function puntosPrincipales(i: InformeProyecto): string[] {
  const p: string[] = [];
  const g = i.semaforo.general;
  if (g) {
    const causas = causasSemaforo(i);
    p.push(`Estado general: ${ETIQUETA_COLOR[g]}${causas.length ? ` — por ${causas.join(", ")}` : " — todas las dimensiones en verde"}.`);
  } else {
    p.push("Estado general: sin datos suficientes todavía (falta registrar mediciones de valor ganado o riesgos).");
  }
  if (i.avanceFisico !== null) {
    p.push(`Avance físico ${pct(i.avanceFisico)}${i.avancePlan !== null ? ` frente a ${pct(i.avancePlan)} planeado` : ""}; costo real ejecutado ${pct(i.avanceFinanciero ?? 0)} del presupuesto${i.eac !== null && i.bac !== null ? `; proyección de costo final ${pesosCorto(i.eac)} (presupuesto ${pesosCorto(i.bac)})` : ""}.`);
  }
  if (i.riesgos.activos > 0) {
    p.push(`${i.riesgos.activos} riesgo(s) activo(s): ${i.riesgos.criticos} crítico(s), ${i.riesgos.altos} alto(s), ${i.riesgos.medios} medio(s), ${i.riesgos.bajos} bajo(s).`);
  }
  if (i.cambios.pendientes > 0) p.push(`${i.cambios.pendientes} cambio(s) pendiente(s) de cierre${i.cambios.criticos ? `, ${i.cambios.criticos} crítico(s)` : ""}.`);
  if (i.hitos.vencidos.length > 0) p.push(`${i.hitos.vencidos.length} hito(s) vencido(s) sin cumplir (el más antiguo: ${i.hitos.vencidos[0].nombre}, ${fechaCorta(i.hitos.vencidos[0].fecha)}).`);
  else if (i.hitos.proximos.length > 0) p.push(`Próximo hito: ${i.hitos.proximos[0].nombre} (${fechaCorta(i.hitos.proximos[0].fecha)}).`);
  if (i.decisiones.length > 0) p.push(`${i.decisiones.length} decisión(es) pendiente(s) de la dirección.`);
  return p;
}

// Resumen del portafolio para el encabezado del correo.
export function resumenPortafolio(informes: InformeProyecto[]): { total: number; verdes: number; amarillos: number; rojos: number; sinDatos: number } {
  const c = (color: Color | null) => informes.filter((x) => x.semaforo.general === color).length;
  return { total: informes.length, verdes: c("verde"), amarillos: c("amarillo"), rojos: c("rojo"), sinDatos: c(null) };
}

// Texto a una línea, con puntos suspensivos si no cabe.
export function recortar(t: string | null | undefined, max: number): string {
  const s = (t ?? "").replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, Math.max(0, max - 1)).trimEnd()}…` : s;
}
