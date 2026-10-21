// Informe gerencial de UNA hoja de Excel, listo para imprimir en una sola página A4 vertical.
// Mismo contenido y misma paleta que el PDF (sistema de diseño GreenLand v1.0.0: Archivo, verde #027001, texto #5E5E5E, alertas sobrias); las cifras van como números reales (se pueden copiar y operar).
import ExcelJS from "exceljs";
import { LEMA_PLATAFORMA, NOMBRE_EMPRESA, NOMBRE_PLATAFORMA } from "../marca";
import { ETIQUETA_ESTADO, ETIQUETA_FASE, type EstadoProyecto, type FaseProyecto } from "../tipos";
import type { Color } from "../pmo/semaforo";
import { LOGO_PNG } from "./fuentes";
import { ETIQUETA_NIVEL, causasSemaforo, fechaCorta, puntosPrincipales, recortar, type InformeProyecto } from "./modelo";

const argb = (h: string) => `FF${h.replace("#", "").toUpperCase()}`;
const VERDE = { h600: argb("#027001"), h700: argb("#027001"), h800: argb("#5e5e5e"), h900: argb("#5e5e5e"), h100: argb("#ffffff"), h50: argb("#ffffff"), tierra: argb("#027001"), borde: argb("#e4e4e4"), gris: argb("#5e5e5e") };
// Paleta de alertas 2.1: texto del estado y fondo tenue. Verde = Cumple, Amarillo = Atención, Rojo = Crítico.
const SEM: Record<Color, { fondo: string; texto: string; nombre: string }> = {
  verde: { fondo: argb("#e6f0e6"), texto: argb("#027001"), nombre: "Verde" },
  amarillo: { fondo: argb("#fbefd9"), texto: argb("#9a5b00"), nombre: "Amarillo" },
  rojo: { fondo: argb("#f8e6e4"), texto: argb("#a32a1f"), nombre: "Rojo" },
};
const NIVEL: Record<string, { fondo: string; texto: string }> = { critico: SEM.rojo, alto: { fondo: argb("#fbefd9"), texto: argb("#9a5b00") }, medio: { fondo: argb("#f2f2f2"), texto: argb("#5e5e5e") }, bajo: SEM.verde };
const SIN_DATOS = { fondo: argb("#f2f2f2"), texto: argb("#5e5e5e"), nombre: "Sin datos" };
const FUENTE = "Archivo";
const FUENTE_TITULO = "Archivo Light";
const COLS = 12;

export async function informeAExcel(i: InformeProyecto): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  libro.creator = `${NOMBRE_PLATAFORMA} · ${NOMBRE_EMPRESA}`;
  libro.created = new Date();
  const h = libro.addWorksheet("Informe gerencial", { views: [{ showGridLines: false }], properties: { defaultRowHeight: 15, tabColor: { argb: argb("#027001") } } });
  for (let c = 1; c <= COLS; c++) h.getColumn(c).width = 11.5;

  let fila = 1;
  const rellenar = (r: number, c1: number, c2: number, fondo?: string) => {
    for (let c = c1; c <= c2; c++) if (fondo) h.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: fondo } };
  };
  const unir = (r1: number, c1: number, r2: number, c2: number, valor: ExcelJS.CellValue, o: { font?: Partial<ExcelJS.Font>; fondo?: string; alinear?: Partial<ExcelJS.Alignment>; fmt?: string } = {}) => {
    if (r1 !== r2 || c1 !== c2) h.mergeCells(r1, c1, r2, c2);
    const celda = h.getCell(r1, c1);
    celda.value = valor;
    celda.font = { name: FUENTE, size: 10, color: { argb: VERDE.h900 }, ...o.font };
    celda.alignment = { vertical: "middle", wrapText: true, ...o.alinear };
    if (o.fmt) celda.numFmt = o.fmt;
    for (let r = r1; r <= r2; r++) rellenar(r, c1, c2, o.fondo);
    return celda;
  };
  const marco = (r1: number, c1: number, r2: number, c2: number, color = VERDE.borde) => {
    const lado = { style: "thin" as const, color: { argb: color } };
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) {
      h.getCell(r, c).border = { top: r === r1 ? lado : undefined, bottom: r === r2 ? lado : undefined, left: c === c1 ? lado : undefined, right: c === c2 ? lado : undefined };
    }
  };

  // ---- Encabezado ----------------------------------------------------------------------------
  h.getRow(1).height = 22; h.getRow(2).height = 18; h.getRow(3).height = 8;
  const logo = libro.addImage({ base64: LOGO_PNG, extension: "png" });
  h.addImage(logo, { tl: { col: 0.1, row: 0.15 }, ext: { width: 142, height: 43 } });
  unir(1, 7, 1, COLS, "Informe gerencial", { font: { name: FUENTE_TITULO, size: 15, color: { argb: VERDE.h600 } }, alinear: { horizontal: "right" } });
  unir(2, 7, 2, COLS, `${NOMBRE_PLATAFORMA} · ${LEMA_PLATAFORMA}`, { font: { size: 9, color: { argb: VERDE.gris } }, alinear: { horizontal: "right" } });
  for (let c = 1; c <= COLS; c++) h.getCell(3, c).border = { bottom: { style: "medium", color: { argb: VERDE.h600 } } };
  fila = 4;

  // ---- Proyecto ------------------------------------------------------------------------------
  const p = i.proyecto;
  h.getRow(fila).height = 30;
  unir(fila, 1, fila, COLS, p.nombre, { font: { name: FUENTE_TITULO, size: 20, color: { argb: VERDE.h700 } }, alinear: { vertical: "bottom" } });
  fila++;
  const meta = [p.codigo, p.cliente && `Cliente: ${p.cliente}`, p.ubicacion, ETIQUETA_FASE[p.fase as FaseProyecto] ?? p.fase, ETIQUETA_ESTADO[p.estado as EstadoProyecto] ?? p.estado].filter(Boolean).join("  ·  ");
  unir(fila++, 1, fila - 1, COLS, meta, { font: { size: 9.5, color: { argb: VERDE.gris } } });
  const meta2 = [p.gerente && `Gerente: ${p.gerente}`, p.inicio && `Inicio: ${fechaCorta(p.inicio)}`, p.duracionMeses !== null && `Duración: ${p.duracionMeses} ${p.duracionMeses === 1 ? "mes" : "meses"}`, i.corteEvm ? `Indicadores al ${fechaCorta(i.corteEvm)}` : "Sin mediciones de valor ganado", `Generado: ${fechaCorta(i.generado)}`].filter(Boolean).join("  ·  ");
  unir(fila++, 1, fila - 1, COLS, meta2, { font: { size: 9.5, color: { argb: VERDE.gris } } });
  h.getRow(fila++).height = 6;

  // ---- Estado general + dimensiones ----------------------------------------------------------
  const g = i.semaforo.general;
  const est = g ? SEM[g] : SIN_DATOS;
  const causas = causasSemaforo(i);
  const explicacion = g === null ? "Aún no hay mediciones de valor ganado ni riesgos registrados." : g === "verde" ? "Cronograma, costo, riesgos y cambios dentro de los umbrales." : `Se explica por: ${causas.join("; ")}.`;
  h.getRow(fila).height = 22; h.getRow(fila + 1).height = 22;
  unir(fila, 1, fila + 1, 3, `Estado general: ${est.nombre}`, { font: { size: 13, color: { argb: est.texto } }, fondo: est.fondo, alinear: { horizontal: "left", indent: 1 } });
  unir(fila, 4, fila + 1, COLS, explicacion, { font: { size: 10, color: { argb: est.texto } }, fondo: est.fondo });
  marco(fila, 1, fila + 1, COLS, est.texto);
  fila += 2;
  h.getRow(fila++).height = 5;
  h.getRow(fila).height = 20;
  const dims: [string, Color | null][] = [["Cronograma", i.semaforo.spi], ["Costo", i.semaforo.cpi], ["Riesgos", i.semaforo.riesgos], ["Cambios", i.semaforo.cambios]];
  dims.forEach(([n, c], k) => {
    const s = c ? SEM[c] : SIN_DATOS;
    unir(fila, k * 3 + 1, fila, k * 3 + 3, `${n}: ${s.nombre}`, { font: { size: 10, color: { argb: s.texto } }, fondo: s.fondo, alinear: { horizontal: "center" } });
    marco(fila, k * 3 + 1, fila, k * 3 + 3, s.texto);
  });
  fila++;
  h.getRow(fila++).height = 8;

  // ---- Tarjetas de indicadores ---------------------------------------------------------------
  const vac = i.bac !== null && i.eac !== null ? i.bac - i.eac : null;
  type Tarjeta = [string, number | string | null, string, string];
  const pctN = (n: number | null) => (n === null ? null : n);
  const filasT: Tarjeta[][] = [
    [
      ["Cronograma (SPI)", i.spi, i.avancePlan !== null ? `Avance planeado ${i.avancePlan.toLocaleString("es-CO", { maximumFractionDigits: 1 })} %` : "Sin medición", "0.00"],
      ["Costo (CPI)", i.cpi, i.avanceFinanciero !== null ? `Costo real ${i.avanceFinanciero.toLocaleString("es-CO", { maximumFractionDigits: 1 })} % del BAC` : "Sin medición", "0.00"],
      ["Avance físico (%)", pctN(i.avanceFisico), i.avancePlan !== null ? `Planeado ${i.avancePlan.toLocaleString("es-CO", { maximumFractionDigits: 1 })} %` : "Sin medición", '0.0"%"'],
      ["Presupuesto BAC (COP)", i.bac, i.ac !== null ? `Costo real ${Math.round(i.ac).toLocaleString("es-CO")}` : "Sin medición", '"$" #,##0'],
    ],
    [
      ["Costo final proyectado (COP)", i.eac, vac === null ? "Requiere costo real y avance" : `${vac >= 0 ? "Ahorro" : "Sobrecosto"} ${Math.round(Math.abs(vac)).toLocaleString("es-CO")}`, '"$" #,##0'],
      ["Riesgos activos", i.riesgos.activos, `${i.riesgos.criticos} crítico(s) · ${i.riesgos.altos} alto(s)`, "0"],
      ["Cambios pendientes", i.cambios.pendientes, `${i.cambios.criticos} crítico(s)`, "0"],
      ["Decisiones pendientes", i.decisiones.length, "De la dirección", "0"],
    ],
  ];
  for (const fT of filasT) {
    h.getRow(fila).height = 15; h.getRow(fila + 1).height = 30; h.getRow(fila + 2).height = 15;
    fT.forEach(([etq, valor, sub, fmt], k) => {
      const c1 = k * 3 + 1, c2 = c1 + 2;
      unir(fila, c1, fila, c2, etq, { font: { size: 8, color: { argb: VERDE.h800 } }, fondo: VERDE.h100, alinear: { horizontal: "left", indent: 1, vertical: "bottom" } });
      unir(fila + 1, c1, fila + 1, c2, valor === null ? "—" : valor, { font: { size: 18, color: { argb: VERDE.h700 } }, fondo: VERDE.h100, alinear: { horizontal: "left", indent: 1 }, fmt });
      unir(fila + 2, c1, fila + 2, c2, sub, { font: { size: 8, color: { argb: VERDE.gris } }, fondo: VERDE.h100, alinear: { horizontal: "left", indent: 1, vertical: "top" } });
      marco(fila, c1, fila + 2, c2, argb("#027001"));
    });
    fila += 3;
    h.getRow(fila++).height = 6;
  }
  h.getRow(fila++).height = 4;

  // ---- Lectura rápida ------------------------------------------------------------------------
  unir(fila, 1, fila, COLS, "Lectura rápida", { font: { size: 12, color: { argb: VERDE.h700 } }, fondo: VERDE.h50, alinear: { indent: 1 } });
  h.getRow(fila++).height = 20;
  const puntos = puntosPrincipales(i).slice(0, 5);
  const ini = fila;
  for (const t of puntos) {
    h.getRow(fila).height = t.length > 175 ? 27 : 15;
    unir(fila, 1, fila, COLS, `•  ${t}`, { font: { size: 9.5 }, fondo: VERDE.h50, alinear: { indent: 1, vertical: "top" } });
    fila++;
  }
  marco(ini - 1, 1, fila - 1, COLS, argb("#e4e4e4"));
  h.getRow(fila++).height = 10;

  // ---- Riesgos principales (izq.) y decisiones + hitos (der.) --------------------------------
  const inicioBloque = fila;
  const sub = (r: number, c1: number, c2: number, t: string, der?: string) => {
    unir(r, c1, r, c2, t, { font: { size: 12, color: { argb: VERDE.h700 } } });
    if (der) h.getCell(r, c2).value = null;
    h.getRow(r).height = 20;
  };
  sub(fila, 1, 7, `Riesgos principales (${i.riesgos.activos} activos)`);
  sub(fila, 8, COLS, "Requiere decisión");
  fila++;
  let fr = fila;
  const lineaFina = (r: number, c1: number, c2: number) => { for (let c = c1; c <= c2; c++) h.getCell(r, c).border = { top: { style: "hair", color: { argb: VERDE.borde } } }; };
  if (i.riesgos.principales.length === 0) { unir(fr, 1, fr, 7, "Sin riesgos activos registrados.", { font: { size: 9.5, color: { argb: VERDE.gris } } }); fr++; }
  for (const r of i.riesgos.principales) {
    h.getRow(fr).height = 28;
    const n = NIVEL[r.nivel];
    unir(fr, 1, fr, 1, r.codigo, { font: { size: 9, color: { argb: VERDE.h800 } } });
    unir(fr, 2, fr, 6, recortar(r.descripcion, 150), { font: { size: 9 } });
    unir(fr, 7, fr, 7, ETIQUETA_NIVEL[r.nivel], { font: { size: 9, color: { argb: n.texto } }, fondo: n.fondo, alinear: { horizontal: "center" } });
    lineaFina(fr, 1, 7);
    fr++;
  }
  let fd = fila;
  if (i.decisiones.length === 0) { unir(fd, 8, fd, COLS, "Nada pendiente de la dirección.", { font: { size: 9.5, color: { argb: VERDE.gris } } }); fd++; }
  for (const d of i.decisiones.slice(0, 3)) {
    h.getRow(fd).height = Math.max(h.getRow(fd).height ?? 15, 28);
    unir(fd, 8, fd, COLS, `${d.tipo}: ${recortar(d.detalle, 110)}`, { font: { size: 9 } });
    lineaFina(fd, 8, COLS);
    fd++;
  }
  const hitos: [string, string, boolean][] = [...i.hitos.vencidos.map((x): [string, string, boolean] => [x.nombre, x.fecha, true]), ...i.hitos.proximos.map((x): [string, string, boolean] => [x.nombre, x.fecha, false])].slice(0, 4);
  sub(Math.max(fd, fila), 8, COLS, "Hitos");
  fd = Math.max(fd, fila) + 1;
  if (hitos.length === 0) { unir(fd, 8, fd, COLS, "Sin hitos pendientes registrados.", { font: { size: 9.5, color: { argb: VERDE.gris } } }); fd++; }
  for (const [nombre, fecha, vencido] of hitos) {
    h.getRow(fd).height = Math.max(h.getRow(fd).height ?? 15, 15);
    unir(fd, 8, fd, COLS, `${vencido ? "Vencido " : ""}${fechaCorta(fecha)} — ${recortar(nombre, 60)}`, { font: { size: 9, color: { argb: vencido ? SEM.rojo.texto : VERDE.h900 }, bold: vencido } });
    lineaFina(fd, 8, COLS);
    fd++;
  }
  fila = Math.max(fr, fd, inicioBloque + 1) + 1;
  h.getRow(fila++).height = 6;

  // ---- Cambios pendientes y último reporte ---------------------------------------------------
  sub(fila, 1, 6, "Cambios pendientes");
  sub(fila, 7, COLS, i.reporte ? `Último reporte semanal (semana ${i.reporte.semana} de ${i.reporte.anio} · ${SEM[i.reporte.estado].nombre})` : "Último reporte semanal");
  fila++;
  let fc = fila;
  if (i.cambios.lista.length === 0) { unir(fc, 1, fc, 6, "Sin cambios pendientes.", { font: { size: 9.5, color: { argb: VERDE.gris } } }); fc++; }
  for (const c of i.cambios.lista) {
    h.getRow(fc).height = 15;
    unir(fc, 1, fc, 1, c.codigo, { font: { size: 9, color: { argb: VERDE.h800 } } });
    unir(fc, 2, fc, 6, `${recortar(c.descripcion, 55)} · ${c.estado}`, { font: { size: 9 } });
    lineaFina(fc, 1, 6);
    fc++;
  }
  if (i.cambios.pendientes > i.cambios.lista.length) { unir(fc, 1, fc, 6, `y ${i.cambios.pendientes - i.cambios.lista.length} más en la plataforma`, { font: { size: 8.5, color: { argb: VERDE.gris } } }); fc++; }
  let fp = fila;
  if (!i.reporte) { unir(fp, 7, fp, COLS, "Aún no hay reportes enviados.", { font: { size: 9.5, color: { argb: VERDE.gris } } }); fp++; }
  else {
    for (const [etq, texto] of [["Logros", i.reporte.logros], ["Alertas", i.reporte.alertas]] as const) {
      if (!texto) continue;
      h.getRow(fp).height = Math.max(h.getRow(fp).height ?? 15, 38);
      unir(fp, 7, fp, COLS, `${etq}: ${recortar(texto, 170)}`, { font: { size: 9, color: { argb: VERDE.gris } }, alinear: { vertical: "top" } });
      lineaFina(fp, 7, COLS);
      fp++;
    }
  }
  fila = Math.max(fc, fp) + 1;
  h.getRow(fila++).height = 6;

  // ---- Pie -----------------------------------------------------------------------------------
  for (let c = 1; c <= COLS; c++) h.getCell(fila, c).border = { top: { style: "thin", color: { argb: VERDE.borde } } };
  unir(fila, 1, fila, 9, `${NOMBRE_PLATAFORMA} · ${NOMBRE_EMPRESA}  |  Informe generado automáticamente con los datos de la plataforma el ${fechaCorta(i.generado)}.`, { font: { size: 8, color: { argb: VERDE.gris } } });
  unir(fila, 10, fila, COLS, "Montos en pesos colombianos (COP)", { font: { size: 8, color: { argb: VERDE.gris } }, alinear: { horizontal: "right" } });

  h.pageSetup = { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 1, horizontalCentered: true, margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 }, printArea: `A1:L${fila}` };
  return Buffer.from(await libro.xlsx.writeBuffer());
}
