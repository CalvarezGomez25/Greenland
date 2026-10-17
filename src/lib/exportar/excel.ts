// Excel con la identidad de la plataforma (la misma del informe gerencial): logo, paleta verde, encabezados de color,
// filas alternadas y etiquetas de semáforo. Sin cuadrícula, con paneles fijos y listo para imprimir en horizontal.
import ExcelJS from "exceljs";
import { LEMA_PLATAFORMA, NOMBRE_EMPRESA, NOMBRE_PLATAFORMA } from "../marca";
import { LOGO_PNG } from "../informe/fuentes";
import { TONOS, tonoDeTexto } from "./tonos";
import type { DocExport } from "./tipos";

const argb = (h: string) => `FF${h.replace("#", "").toUpperCase()}`;
const V = { h50: argb("#f4f9ea"), h100: argb("#e6f1d1"), h600: argb("#4c700b"), h700: argb("#386631"), h900: argb("#164504"), borde: argb("#dcdcd8"), gris: argb("#555552"), tierra: argb("#7c401d") };
const FUENTE = "Calibri";
const SIN_INFO = "S/I"; // dato sin información, como en las demás hojas de cálculo de Greenland
const FORMATOS: Record<string, string> = { entero: "#,##0", pesos: '#,##0;-#,##0;"-"', decimal2: "#,##0.00", porcentaje: '0.0"%"' };

// Nombre de hoja válido para Excel (máx. 31 caracteres, sin : \ / ? * [ ]).
export const nombreHoja = (t: string, usados: Set<string>): string => {
  const base = t.replace(/[:\\/?*[\]]/g, " ").trim().slice(0, 28) || "Hoja";
  let n = base;
  let i = 2;
  while (usados.has(n.toLowerCase())) n = `${base.slice(0, 26)} ${i++}`;
  usados.add(n.toLowerCase());
  return n;
};

export async function aExcel(doc: DocExport): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  libro.creator = `${NOMBRE_PLATAFORMA} · ${NOMBRE_EMPRESA}`;
  libro.created = new Date();
  libro.title = doc.titulo;
  const logo = libro.addImage({ base64: LOGO_PNG, extension: "png" });
  const usados = new Set<string>();

  for (const t of doc.tablas) {
    const nCol = t.columnas.length;
    const hoja = libro.addWorksheet(nombreHoja(t.titulo, usados), {
      views: [{ showGridLines: false, zoomScale: 85 }],
      properties: { tabColor: { argb: V.h600 }, defaultRowHeight: 15 },
    });
    // Anchos según el contenido; la primera columna deja espacio al logo.
    t.columnas.forEach((c, i) => {
      const mayor = Math.max(c.length, ...t.filas.map((f) => String(f[i] ?? SIN_INFO).length));
      hoja.getColumn(i + 1).width = Math.min(60, Math.max(i === 0 ? 22 : 11, mayor + 2));
    });
    const anchoTotal = t.columnas.reduce((s, _, i) => s + (hoja.getColumn(i + 1).width ?? 11), 0);
    const unir = (r: number, c1: number, c2: number, valor: ExcelJS.CellValue, font: Partial<ExcelJS.Font>, alinear: Partial<ExcelJS.Alignment> = {}) => {
      if (c2 > c1) hoja.mergeCells(r, c1, r, c2);
      const celda = hoja.getCell(r, c1);
      celda.value = valor;
      celda.font = { name: FUENTE, size: 10, color: { argb: V.h900 }, ...font };
      celda.alignment = { vertical: "middle", wrapText: true, ...alinear };
    };

    // ---- Encabezado de marca ----------------------------------------------------------------
    hoja.getRow(1).height = 22; hoja.getRow(2).height = 18; hoja.getRow(3).height = 8;
    hoja.addImage(logo, { tl: { col: 0.1, row: 0.15 }, ext: { width: 142, height: 43 } });
    if (nCol >= 2) {
      unir(1, 2, nCol, NOMBRE_PLATAFORMA, { bold: true, size: 15, color: { argb: V.h600 } }, { horizontal: "right", wrapText: false });
      unir(2, 2, nCol, `${NOMBRE_EMPRESA} · ${LEMA_PLATAFORMA}`, { size: 9, color: { argb: V.gris } }, { horizontal: "right", wrapText: false });
    }
    for (let c = 1; c <= nCol; c++) hoja.getCell(3, c).border = { bottom: { style: "medium", color: { argb: V.h600 } } };

    // ---- Título del documento y de la tabla ---------------------------------------------------
    hoja.getRow(4).height = 28;
    unir(4, 1, nCol, doc.titulo, { bold: true, size: 16, color: { argb: V.h700 } }, { vertical: "bottom", wrapText: false });
    unir(5, 1, nCol, [doc.subtitulo, `Generado: ${doc.generado}`].filter(Boolean).join("  ·  "), { size: 9.5, color: { argb: V.gris } });
    hoja.getRow(6).height = 8;
    hoja.getRow(7).height = 20;
    unir(7, 1, nCol, t.titulo, { bold: true, size: 12, color: { argb: V.h700 } }, { wrapText: false });
    let fila = 8;
    if (t.nota) {
      hoja.getRow(fila).height = Math.max(15, Math.ceil(t.nota.length / Math.max(30, anchoTotal * 1.1)) * 13);
      unir(fila, 1, nCol, t.nota, { italic: true, size: 9, color: { argb: V.gris } }, { vertical: "top" });
      fila++;
    }
    hoja.getRow(fila).height = 6;
    fila++;

    // ---- Tabla ------------------------------------------------------------------------------
    const filaCab = fila;
    hoja.getRow(filaCab).height = 24;
    t.columnas.forEach((c, i) => {
      const celda = hoja.getCell(filaCab, i + 1);
      celda.value = c;
      celda.font = { name: FUENTE, size: 10, bold: true, color: { argb: argb("#ffffff") } };
      celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: V.h600 } };
      celda.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    });
    const hair = { style: "hair" as const, color: { argb: V.borde } };
    t.filas.forEach((f, r) => {
      const fi = filaCab + 1 + r;
      f.forEach((c, i) => {
        const celda = hoja.getCell(fi, i + 1);
        const fmt = t.formatoFilas?.[r] ?? t.formato?.[i];
        const etiqueta = typeof c === "string" && t.insignias?.includes(i) ? tonoDeTexto(c) : null;
        celda.font = { name: FUENTE, size: 10, color: { argb: V.h900 } };
        celda.border = { bottom: hair };
        if (r % 2 === 1) celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: V.h50 } };
        if (c === null || c === "") {
          celda.value = SIN_INFO;
          celda.font = { name: FUENTE, size: 9, italic: true, color: { argb: V.gris } };
          celda.alignment = { horizontal: "center", vertical: "top" };
        } else if (typeof c === "number") {
          celda.value = c;
          if (fmt && FORMATOS[fmt]) celda.numFmt = FORMATOS[fmt];
          celda.alignment = { horizontal: "right", vertical: "top" };
        } else if (etiqueta) {
          const tono = TONOS[etiqueta];
          celda.value = c;
          celda.font = { name: FUENTE, size: 10, bold: true, color: { argb: argb(tono.texto) } };
          celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(tono.fondo) } };
          celda.alignment = { horizontal: "center", vertical: "top" };
        } else {
          celda.value = c;
          celda.alignment = { vertical: "top", wrapText: true };
        }
      });
    });
    // contorno de la tabla
    const ultima = Math.max(filaCab, filaCab + t.filas.length);
    const lado = { style: "thin" as const, color: { argb: V.h600 } };
    for (let r = filaCab; r <= ultima; r++) for (let c = 1; c <= nCol; c++) {
      const celda = hoja.getCell(r, c);
      celda.border = { ...celda.border, left: c === 1 ? lado : celda.border?.left, right: c === nCol ? lado : celda.border?.right, bottom: r === ultima ? lado : celda.border?.bottom };
    }
    if (t.filas.length === 0) unir(filaCab + 1, 1, nCol, "Sin registros.", { italic: true, color: { argb: V.gris } });

    // ---- Pie y vista ------------------------------------------------------------------------
    const pie = Math.max(ultima, filaCab + 1) + 2;
    for (let c = 1; c <= nCol; c++) hoja.getCell(pie, c).border = { top: { style: "thin", color: { argb: V.borde } } };
    const textoPie = `${NOMBRE_PLATAFORMA} · ${NOMBRE_EMPRESA}  |  Documento generado automáticamente con los datos de la plataforma el ${doc.generado}. Montos en pesos colombianos (COP). S/I = sin información.`;
    hoja.getRow(pie).height = Math.max(12, Math.ceil(textoPie.length / Math.max(30, anchoTotal * 1.25)) * 11);
    unir(pie, 1, nCol, textoPie, { size: 8, color: { argb: V.gris } }, { vertical: "top" });
    hoja.views = [{ state: "frozen", ySplit: filaCab, xSplit: nCol > 5 ? 1 : 0, showGridLines: false, zoomScale: 85 }];
    hoja.pageSetup = {
      paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.2, footer: 0.25 },
      printTitlesRow: `${filaCab}:${filaCab}`,
    };
    hoja.headerFooter = { oddFooter: `&L&8${NOMBRE_PLATAFORMA} · ${NOMBRE_EMPRESA}&R&8Página &P de &N` };
  }
  return Buffer.from(await libro.xlsx.writeBuffer());
}
