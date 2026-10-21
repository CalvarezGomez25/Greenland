// Informe gerencial de UNA página (A4 vertical) con el sistema de diseño GreenLand v1.0.0: tipografía Archivo,
// verde #027001, tarjetas con muesca y estados con la paleta de alertas. Se dibuja con pdf-lib, sin servicios externos.
import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { LEMA_PLATAFORMA, NOMBRE_EMPRESA, NOMBRE_PLATAFORMA } from "../marca";
import { ETIQUETA_ESTADO, ETIQUETA_FASE, type EstadoProyecto, type FaseProyecto } from "../tipos";
import type { Color } from "../pmo/semaforo";
import { ARCHIVO_300, ARCHIVO_400, ARCHIVO_500, LOGO_PNG } from "./fuentes";
import { ETIQUETA_NIVEL, causasSemaforo, fechaCorta, pesosCorto, puntosPrincipales, recortar, type InformeProyecto } from "./modelo";

// Las fuentes de la marca incluyen tildes, comillas y rayas; solo se sustituyen los símbolos que no traen.
export const limpiar = (t: string): string =>
  t.replace(/≥/g, ">=").replace(/≤/g, "<=").replace(/[→↑↓]/g, "").replace(/\u00a0/g, " ")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\u00A1-\u00FF\u2013\u2014\u2018\u2019\u201C\u201D\u2026\u2022]/g, "").replace(/ {2,}/g, " ");

const W = 595.28, H = 841.89, M = 34, ANCHO = W - 2 * M;
export const hex = (h: string): RGB => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
// Paleta del sistema de diseño GreenLand v1.0.0 (misma de src/app/globals.css). Los nombres leaf* se conservan por compatibilidad.
export const C = {
  hoja: hex("#ffffff"), leaf50: hex("#f2f2f2"), leaf100: hex("#e4e4e4"), leaf200: hex("#e4e4e4"), leaf400: hex("#84b71e"), leaf500: hex("#027001"), leaf600: hex("#027001"),
  leaf700: hex("#027001"), leaf800: hex("#5e5e5e"), leaf900: hex("#5e5e5e"), tierra: hex("#027001"), borde: hex("#e4e4e4"), gris: hex("#5e5e5e"),
};
// Estados: paleta de alertas 2.1 (texto y contorno del mismo color; el fondo tenue solo en celdas). Verde = Cumple, Amarillo = Atención, Rojo = Crítico.
type Estado = { fondo: RGB; borde: RGB; punto: RGB; texto: RGB; nombre: string };
const est = (texto: string, fondo: string, nombre: string): Estado => ({ fondo: hex(fondo), borde: hex(texto), punto: hex(texto), texto: hex(texto), nombre });
const SEM: Record<Color, Estado> = {
  verde: est("#027001", "#e6f0e6", "Verde"),
  amarillo: est("#9a5b00", "#fbefd9", "Amarillo"),
  rojo: est("#a32a1f", "#f8e6e4", "Rojo"),
};
const NIVEL = { critico: SEM.rojo, alto: est("#9a5b00", "#fbefd9", "Alto"), medio: est("#5e5e5e", "#f2f2f2", "Medio"), bajo: SEM.verde };
const SIN_DATOS = est("#5e5e5e", "#f2f2f2", "Sin datos");

const num2 = (n: number | null) => (n === null ? "—" : n.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const pct = (n: number | null) => (n === null ? "—" : `${n.toLocaleString("es-CO", { maximumFractionDigits: 1 })} %`);

export type Fuentes = { titulo: PDFFont; normal: PDFFont; medio: PDFFont };

export class Lienzo {
  constructor(readonly p: PDFPage, readonly f: Fuentes) {}
  // y se mide desde ARRIBA de la página (más natural para maquetar).
  Y = (y: number) => this.p.getHeight() - y;
  caja(x: number, y: number, w: number, h: number, o: { fondo?: RGB; borde?: RGB; radio?: number; grosor?: number }) {
    const r = Math.min(o.radio ?? 8, w / 2, h / 2);
    const d = `M ${r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r} V ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} H ${r} A ${r} ${r} 0 0 1 0 ${h - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
    this.p.drawSvgPath(d, { x, y: this.Y(y), color: o.fondo, borderColor: o.borde, borderWidth: o.borde ? (o.grosor ?? 0.8) : 0 });
  }
  // Tarjeta con muesca: sin relleno, contorno verde y el título en una pill verde sólida sobre el borde superior.
  muesca(x: number, y: number, w: number, h: number, titulo: string, o: { color?: RGB } = {}) {
    const color = o.color ?? C.leaf500;
    this.caja(x, y, w, h, { fondo: C.hoja, borde: color, radio: 10, grosor: 0.9 });
    const t = limpiar(titulo), tam = 6.6;
    const ancho = Math.min(w - 12, this.f.medio.widthOfTextAtSize(t, tam) + 14);
    this.caja(x + (w - ancho) / 2, y - 5.5, ancho, 11, { fondo: color, radio: 5.5 });
    this.texto(t, x + w / 2, y + 2.4, { f: this.f.medio, tam, color: C.hoja, ancho: ancho - 8, centro: true });
  }
  punto(x: number, y: number, r: number, color: RGB) { this.p.drawCircle({ x, y: this.Y(y), size: r, color }); }
  linea(x1: number, y1: number, x2: number, y2: number, color: RGB, grosor = 0.6) { this.p.drawLine({ start: { x: x1, y: this.Y(y1) }, end: { x: x2, y: this.Y(y2) }, thickness: grosor, color }); }
  // Texto en una línea; si no cabe en `ancho`, se corta con «…».
  texto(t: string, x: number, y: number, o: { f?: PDFFont; tam: number; color?: RGB; ancho?: number; derecha?: boolean; centro?: boolean }) {
    const f = o.f ?? this.f.normal;
    let s = limpiar(t);
    if (o.ancho !== undefined) s = s.slice(0, Math.ceil(o.ancho / (o.tam * 0.22)) + 2); // evita medir textos larguísimos carácter a carácter
    if (o.ancho !== undefined && f.widthOfTextAtSize(s, o.tam) > o.ancho) {
      while (s.length > 1 && f.widthOfTextAtSize(`${s}…`, o.tam) > o.ancho) s = s.slice(0, -1);
      s = `${s.trimEnd()}…`;
    }
    const w = f.widthOfTextAtSize(s, o.tam);
    const px = o.derecha ? x - w : o.centro ? x - w / 2 : x;
    this.p.drawText(s, { x: px, y: this.Y(y), size: o.tam, font: f, color: o.color ?? C.leaf900 });
  }
  // Párrafo con salto de línea, limitado a `maxLineas` (la última se corta con «…»). Devuelve la altura usada.
  parrafo(t: string, x: number, y: number, o: { tam: number; ancho: number; maxLineas: number; interlinea?: number; f?: PDFFont; color?: RGB }): number {
    const f = o.f ?? this.f.normal;
    const lineas = partir(limpiar(t).slice(0, Math.ceil((o.ancho / (o.tam * 0.22)) * (o.maxLineas + 1))), f, o.tam, o.ancho);
    const il = o.interlinea ?? o.tam * 1.3;
    const mostrar = lineas.slice(0, o.maxLineas);
    if (lineas.length > o.maxLineas) mostrar[mostrar.length - 1] = `${mostrar[mostrar.length - 1].replace(/[\s.,;:]+$/, "")}…`;
    mostrar.forEach((l, i) => this.texto(l, x, y + i * il, { f, tam: o.tam, color: o.color, ancho: o.ancho }));
    return mostrar.length * il;
  }
}

export function partir(texto: string, f: PDFFont, tam: number, ancho: number): string[] {
  const lineas: string[] = [];
  for (const par of texto.split(/\r?\n/)) {
    let actual = "";
    for (const palabra of par.split(/\s+/).filter(Boolean)) {
      const prueba = actual ? `${actual} ${palabra}` : palabra;
      if (f.widthOfTextAtSize(prueba, tam) <= ancho) actual = prueba;
      else { if (actual) lineas.push(actual); actual = palabra; }
    }
    lineas.push(actual);
  }
  return lineas;
}

export async function informeAPdf(i: InformeProyecto): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const f: Fuentes = {
    titulo: await pdf.embedFont(Buffer.from(ARCHIVO_300, "base64"), { subset: true }),
    normal: await pdf.embedFont(Buffer.from(ARCHIVO_400, "base64"), { subset: true }),
    medio: await pdf.embedFont(Buffer.from(ARCHIVO_500, "base64"), { subset: true }),
  };
  const logo = await pdf.embedPng(Buffer.from(LOGO_PNG, "base64"));
  pdf.setTitle(limpiar(`Informe gerencial - ${i.proyecto.nombre}`));
  pdf.setAuthor(`${NOMBRE_PLATAFORMA} · ${NOMBRE_EMPRESA}`);
  pdf.setCreator(NOMBRE_PLATAFORMA);
  const pagina = pdf.addPage([W, H]);
  const L = new Lienzo(pagina, f);
  const g = i.semaforo.general;
  const estado = g ? SEM[g] : SIN_DATOS;

  // ---- Encabezado --------------------------------------------------------------------------------
  const lh = 30;
  pagina.drawImage(logo, { x: M, y: L.Y(M + lh), width: (lh * logo.width) / logo.height, height: lh });
  L.texto("Informe gerencial", W - M, M + 11, { f: f.titulo, tam: 14, color: C.leaf600, derecha: true });
  L.texto(`${NOMBRE_PLATAFORMA} · ${LEMA_PLATAFORMA}`, W - M, M + 24, { tam: 7.5, color: C.gris, derecha: true });
  L.linea(M, M + 38, W - M, M + 38, C.leaf600, 1);

  // ---- Proyecto ----------------------------------------------------------------------------------
  const p = i.proyecto;
  let y = M + 66;
  const tamNombre = p.nombre.length > 46 ? 17 : 21;
  const hNombre = L.parrafo(p.nombre, M, y, { f: f.titulo, tam: tamNombre, ancho: ANCHO, maxLineas: 2, color: C.leaf700, interlinea: tamNombre * 1.05 });
  y += hNombre + 4;
  const meta = [p.codigo, p.cliente && `Cliente: ${p.cliente}`, p.ubicacion, ETIQUETA_FASE[p.fase as FaseProyecto] ?? p.fase, ETIQUETA_ESTADO[p.estado as EstadoProyecto] ?? p.estado].filter(Boolean).join("  ·  ");
  L.texto(meta, M, y, { tam: 8.5, color: C.gris, ancho: ANCHO });
  y += 12;
  const meta2 = [p.gerente && `Gerente: ${p.gerente}`, p.inicio && `Inicio: ${fechaCorta(p.inicio)}`, p.duracionMeses !== null && `Duración: ${p.duracionMeses} ${p.duracionMeses === 1 ? "mes" : "meses"}`, i.corteEvm ? `Indicadores al ${fechaCorta(i.corteEvm)}` : "Sin mediciones de valor ganado", `Generado: ${fechaCorta(i.generado)}`].filter(Boolean).join("  ·  ");
  L.texto(meta2, M, y, { tam: 8.5, color: C.gris, ancho: ANCHO });
  y += 14;

  // ---- Estado general + dimensiones --------------------------------------------------------------
  const hBanda = 46;
  L.caja(M, y, ANCHO, hBanda, { fondo: C.hoja, borde: estado.borde, radio: 10, grosor: 1.1 });
  L.texto("Estado general", M + 16, y + 17, { f: f.medio, tam: 7.5, color: estado.texto });
  L.texto(estado.nombre, M + 16, y + 35, { f: f.titulo, tam: 18, color: estado.texto });
  const causas = causasSemaforo(i);
  const textoCausa = g === null ? "Aún no hay mediciones de valor ganado ni riesgos registrados." : g === "verde" ? "Cronograma, costo, riesgos y cambios dentro de los umbrales." : `Se explica por: ${causas.join("; ")}.`;
  const hCausa = Math.min(3, partir(limpiar(textoCausa).slice(0, 700), f.normal, 8.5, ANCHO - 165).length) * 11;
  L.parrafo(textoCausa, M + 150, y + hBanda / 2 - hCausa / 2 + 8, { tam: 8.5, ancho: ANCHO - 165, maxLineas: 3, interlinea: 11, color: estado.texto });
  y += hBanda + 8;

  const dims: [string, Color | null][] = [["Cronograma", i.semaforo.spi], ["Costo", i.semaforo.cpi], ["Riesgos", i.semaforo.riesgos], ["Cambios", i.semaforo.cambios]];
  const wD = (ANCHO - 3 * 8) / 4;
  dims.forEach(([nombre, c], k) => {
    const s = c ? SEM[c] : SIN_DATOS;
    const x = M + k * (wD + 8);
    L.caja(x, y, wD, 20, { fondo: C.hoja, borde: C.borde, radio: 10 });
    L.texto(nombre, x + 11, y + 13.2, { f: f.medio, tam: 8, color: C.leaf800 });
    L.texto(s.nombre, x + wD - 10, y + 13.2, { f: f.medio, tam: 8, color: s.texto, derecha: true });
  });
  y += 30;

  // ---- Tarjetas de indicadores -------------------------------------------------------------------
  const vac = i.bac !== null && i.eac !== null ? i.bac - i.eac : null;
  const tarjetas: [string, string, string][][] = [
    [
      ["Cronograma (SPI)", num2(i.spi), i.avancePlan !== null ? `Avance planeado ${pct(i.avancePlan)}` : "Sin medición"],
      ["Costo (CPI)", num2(i.cpi), i.avanceFinanciero !== null ? `Costo real ${pct(i.avanceFinanciero)} del BAC` : "Sin medición"],
      ["Avance físico", pct(i.avanceFisico), i.avancePlan !== null ? `Planeado ${pct(i.avancePlan)}` : "Sin medición"],
      ["Presupuesto (BAC)", pesosCorto(i.bac), i.ac !== null ? `Costo real ${pesosCorto(i.ac)}` : "Sin medición"],
    ],
    [
      ["Costo final proyectado", pesosCorto(i.eac), vac === null ? "Requiere costo real y avance" : `${vac >= 0 ? "Ahorro" : "Sobrecosto"} ${pesosCorto(Math.abs(vac))}`],
      ["Riesgos activos", String(i.riesgos.activos), `${i.riesgos.criticos} crítico(s) · ${i.riesgos.altos} alto(s)`],
      ["Cambios pendientes", String(i.cambios.pendientes), `${i.cambios.criticos} crítico(s)`],
      ["Decisiones pendientes", String(i.decisiones.length), "De la dirección"],
    ],
  ];
  const wT = (ANCHO - 3 * 8) / 4, hT = 54;
  tarjetas.forEach((fila, r) => fila.forEach(([etq, valor, sub], k) => {
    const x = M + k * (wT + 8), yy = y + r * (hT + 8);
    L.muesca(x, yy, wT, hT, etq);
    L.texto(valor, x + wT / 2, yy + 31, { f: f.titulo, tam: 19, color: C.leaf700, ancho: wT - 14, centro: true });
    L.texto(sub, x + wT / 2, yy + 45, { tam: 7, color: C.gris, ancho: wT - 14, centro: true });
  }));
  y += 2 * hT + 8 + 14;

  // ---- Lectura rápida ----------------------------------------------------------------------------
  const puntos = puntosPrincipales(i).slice(0, 5);
  const lineasDe = (t: string) => Math.min(2, partir(limpiar(t).slice(0, 700), f.normal, 8.3, ANCHO - 40).length);
  const hLect = 26 + puntos.reduce((a, t) => a + lineasDe(t) * 10 + 3.5, 0);
  L.caja(M, y, ANCHO, hLect, { fondo: C.hoja, borde: C.borde, radio: 10, grosor: 0.9 });
  L.texto("Lectura rápida", M + 14, y + 15, { f: f.titulo, tam: 11.5, color: C.leaf700 });
  let yy = y + 29;
  for (const t of puntos) {
    const h = L.parrafo(t, M + 14, yy, { tam: 8.3, ancho: ANCHO - 28, maxLineas: 2, color: C.leaf900, interlinea: 10 });
    yy += h + 3.5;
  }
  y += hLect + 12;

  // ---- Riesgos principales (izq.) y decisiones + hitos (der.) --------------------------------------
  const wIzq = ANCHO * 0.58, xDer = M + wIzq + 14, wDer = ANCHO - wIzq - 14;
  L.texto("Riesgos principales", M, y + 10, { f: f.titulo, tam: 12, color: C.leaf700 });
  L.texto(`${i.riesgos.activos} activos`, M + wIzq, y + 10, { tam: 7.5, color: C.gris, derecha: true });
  let yr = y + 18;
  if (i.riesgos.principales.length === 0) {
    L.texto("Sin riesgos activos registrados.", M, yr + 12, { tam: 8.5, color: C.gris });
    yr += 22;
  }
  for (const r of i.riesgos.principales) {
    const s = NIVEL[r.nivel];
    L.linea(M, yr, M + wIzq, yr, C.borde, 0.5);
    L.texto(r.codigo, M, yr + 11, { f: f.medio, tam: 7.8, color: C.leaf800, ancho: 38 });
    L.parrafo(r.descripcion, M + 42, yr + 10.5, { tam: 7.8, ancho: wIzq - 42 - 54, maxLineas: 2, interlinea: 9.2 });
    L.caja(M + wIzq - 48, yr + 4, 48, 14, { fondo: C.hoja, borde: s.borde, radio: 7, grosor: 0.9 });
    L.texto(ETIQUETA_NIVEL[r.nivel], M + wIzq - 24, yr + 14, { f: f.medio, tam: 7, color: s.texto, centro: true });
    yr += 27;
  }

  L.texto("Requiere decisión", xDer, y + 10, { f: f.titulo, tam: 12, color: C.leaf700 });
  let yd = y + 18;
  if (i.decisiones.length === 0) { L.texto("Nada pendiente de la dirección.", xDer, yd + 12, { tam: 8.5, color: C.gris }); yd += 22; }
  for (const d of i.decisiones.slice(0, 3)) {
    L.linea(xDer, yd, xDer + wDer, yd, C.borde, 0.5);
    L.texto(d.tipo, xDer, yd + 11, { f: f.medio, tam: 7.8, color: C.leaf800, ancho: wDer });
    const h = L.parrafo(d.detalle, xDer, yd + 21, { tam: 7.6, ancho: wDer, maxLineas: 2, interlinea: 9, color: C.gris });
    yd += 24 + h;
  }
  yd += 6;
  L.texto("Hitos", xDer, yd + 10, { f: f.titulo, tam: 12, color: C.leaf700 });
  yd += 18;
  const hitos: [string, string, boolean][] = [...i.hitos.vencidos.map((h): [string, string, boolean] => [h.nombre, h.fecha, true]), ...i.hitos.proximos.map((h): [string, string, boolean] => [h.nombre, h.fecha, false])].slice(0, 4);
  if (hitos.length === 0) { L.texto("Sin hitos pendientes registrados.", xDer, yd + 10, { tam: 8.5, color: C.gris }); yd += 22; }
  for (const [nombre, fecha, vencido] of hitos) {
    L.linea(xDer, yd, xDer + wDer, yd, C.borde, 0.5);
    L.texto(nombre, xDer, yd + 12.4, { tam: 7.8, ancho: wDer - (vencido ? 76 : 50) });
    L.texto(vencido ? `Vencido ${fechaCorta(fecha)}` : fechaCorta(fecha), xDer + wDer, yd + 12.4, { f: f.medio, tam: 7.2, color: vencido ? SEM.rojo.texto : C.gris, derecha: true });
    yd += 17;
  }
  y = Math.max(yr, yd) + 10;

  // ---- Cambios pendientes y último reporte -------------------------------------------------------
  const mitad = (ANCHO - 14) / 2, hCaja = Math.min(100, H - 46 - y);
  if (hCaja > 50) {
    L.caja(M, y, mitad, hCaja, { fondo: C.hoja, borde: C.borde, radio: 8 });
    L.texto("Cambios pendientes", M + 10, y + 16, { f: f.titulo, tam: 11, color: C.leaf700 });
    let yc = y + 26;
    if (i.cambios.lista.length === 0) L.texto("Sin cambios pendientes.", M + 10, yc + 8, { tam: 8.2, color: C.gris });
    const caben = Math.max(1, Math.floor((hCaja - 32) / 15));
    const visibles = i.cambios.pendientes > caben ? caben - 1 : caben;
    for (const c of i.cambios.lista.slice(0, visibles)) {
      L.texto(c.codigo, M + 10, yc + 8, { f: f.medio, tam: 7.6, color: C.leaf800, ancho: 40 });
      L.texto(`${recortar(c.descripcion, 60)} · ${c.estado}`, M + 52, yc + 8, { tam: 7.6, ancho: mitad - 62 });
      yc += 15;
    }
    const resto = i.cambios.pendientes - Math.min(i.cambios.lista.length, visibles);
    if (resto > 0 && i.cambios.lista.length > 0) L.texto(`y ${resto} más en la plataforma`, M + 10, yc + 8, { tam: 7.4, color: C.gris });
    const xr = M + mitad + 14;
    L.caja(xr, y, mitad, hCaja, { fondo: C.hoja, borde: C.borde, radio: 8 });
    L.texto("Último reporte semanal", xr + 10, y + 16, { f: f.titulo, tam: 11, color: C.leaf700 });
    if (!i.reporte) L.texto("Aún no hay reportes enviados.", xr + 10, y + 34, { tam: 8.2, color: C.gris });
    else {
      L.texto(`Semana ${i.reporte.semana} de ${i.reporte.anio} · ${SEM[i.reporte.estado].nombre}`, xr + mitad - 10, y + 16, { tam: 7.5, color: C.gris, derecha: true });
      let yp = y + 26;
      const secciones = ([["Logros", i.reporte.logros], ["Alertas", i.reporte.alertas]] as const).filter(([, t]) => t);
      const lineas = secciones.length > 1 && hCaja < 96 ? 1 : 2;
      for (const [etq, texto] of secciones) {
        L.texto(etq, xr + 10, yp + 6, { f: f.medio, tam: 6.5, color: C.leaf800 });
        yp += L.parrafo(texto as string, xr + 10, yp + 15, { tam: 7.6, ancho: mitad - 20, maxLineas: lineas, interlinea: 9, color: C.gris }) + 11;
      }
      if (!i.reporte.logros && !i.reporte.alertas) L.texto("El reporte no trae logros ni alertas.", xr + 10, y + 34, { tam: 8.2, color: C.gris });
    }
  }

  // ---- Pie ---------------------------------------------------------------------------------------
  L.linea(M, H - 36, W - M, H - 36, C.borde, 0.6);
  L.texto(`${NOMBRE_PLATAFORMA} · ${NOMBRE_EMPRESA}  |  Informe generado automáticamente con los datos de la plataforma el ${fechaCorta(i.generado)}.`, M, H - 24, { tam: 7, color: C.gris, ancho: ANCHO - 90 });
  L.texto("Montos en pesos colombianos (COP)", W - M, H - 24, { tam: 7, color: C.gris, derecha: true });
  return pdf.save();
}
