// Lee la hoja de riesgos de un libro de Excel (.xlsx). Solo se usa en el servidor.
import ExcelJS from "exceljs";
import type { Celda } from "./importar";

export const MAX_BYTES_LIBRO = 2 * 1024 * 1024;

function valor(v: ExcelJS.CellValue): Celda {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === "object") {
    if ("result" in v) return valor((v as { result?: ExcelJS.CellValue }).result ?? null);
    if ("richText" in v) return (v as ExcelJS.CellRichTextValue).richText.map((t) => t.text).join("");
    if ("text" in v) return String((v as { text: unknown }).text);
    return null;
  }
  return v as string | number;
}

// Busca la hoja «Registro»; si no existe, usa la primera cuyo encabezado traiga las columnas ID y Riesgo.
export async function leerHojaRiesgos(bytes: ArrayBuffer): Promise<Celda[][]> {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(bytes);
  const hoja =
    libro.worksheets.find((h) => h.name.trim().toLowerCase() === "registro") ??
    libro.worksheets.find((h) => /^id$/i.test(String(valor(h.getRow(1).getCell(1).value) ?? "").trim()));
  if (!hoja) throw new Error("No encontré la hoja «Registro». Renombra la hoja con los riesgos como «Registro».");
  const filas: Celda[][] = [];
  const columnas = Math.min(hoja.columnCount, 40);
  hoja.eachRow({ includeEmpty: false }, (fila, n) => {
    if (n > 1000) return;
    const celdas: Celda[] = [];
    for (let c = 1; c <= columnas; c++) celdas.push(valor(fila.getCell(c).value));
    filas[n - 1] = celdas;
  });
  return Array.from({ length: filas.length }, (_, i) => filas[i] ?? []);
}
