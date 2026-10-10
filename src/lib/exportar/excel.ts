import ExcelJS from "exceljs";
import type { DocExport } from "./tipos";

const FORMATOS: Record<string, string> = { entero: "#,##0", pesos: "#,##0", decimal2: "#,##0.00", porcentaje: '0.0"%"' };

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
  libro.creator = "Plataforma de gestión de proyectos GreenLand";
  libro.created = new Date();
  const usados = new Set<string>();
  for (const t of doc.tablas) {
    const hoja = libro.addWorksheet(nombreHoja(t.titulo, usados));
    hoja.addRow([doc.titulo]).font = { bold: true, size: 14 };
    hoja.addRow([[doc.subtitulo, `Generado: ${doc.generado}`].filter(Boolean).join(" · ")]).font = { color: { argb: "FF555552" } };
    hoja.addRow([t.titulo]).font = { bold: true, size: 12 };
    if (t.nota) hoja.addRow([t.nota]).font = { italic: true };
    hoja.addRow([]);
    const cab = hoja.addRow(t.columnas);
    cab.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cab.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4C700B" } };
    cab.alignment = { vertical: "middle", wrapText: true };
    const filaCab = cab.number;
    for (const f of t.filas) {
      const fila = hoja.addRow(f.map((c) => (c === null ? "" : c)));
      f.forEach((c, i) => {
        const fmt = t.formato?.[i];
        if (typeof c === "number" && fmt && FORMATOS[fmt]) fila.getCell(i + 1).numFmt = FORMATOS[fmt];
        if (typeof c === "number") fila.getCell(i + 1).alignment = { horizontal: "right" };
      });
    }
    t.columnas.forEach((c, i) => {
      const mayor = Math.max(c.length, ...t.filas.map((f) => String(f[i] ?? "").length));
      hoja.getColumn(i + 1).width = Math.min(60, Math.max(10, mayor + 2));
    });
    hoja.views = [{ state: "frozen", ySplit: filaCab }];
  }
  return Buffer.from(await libro.xlsx.writeBuffer());
}
