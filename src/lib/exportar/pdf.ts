// PDF sencillo con tablas (pdf-lib, sin archivos externos). Las fuentes estándar solo admiten caracteres
// latinos (WinAnsi): se sustituyen los símbolos que no existen en ellas.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { DocExport, TablaExport } from "./tipos";

const A4_H: [number, number] = [841.89, 595.28]; // horizontal
const MARGEN = 36;
const VERDE = rgb(0.298, 0.439, 0.043);
const GRIS = rgb(0.33, 0.33, 0.32);

export function limpiar(t: string): string {
  return t
    .replace(/[–—]/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, "...")
    .replace(/≥/g, ">=").replace(/≤/g, "<=").replace(/[→↑↓]/g, "").replace(/ /g, " ")
    .replace(/[^\x09\x0A\x0D\x20-\x7E¡-ÿ]/g, "")
    .replace(/ {2,}/g, " ");
}

function partir(texto: string, fuente: PDFFont, tam: number, ancho: number): string[] {
  const lineas: string[] = [];
  for (const parrafo of limpiar(texto).split(/\r?\n/)) {
    let actual = "";
    for (const palabra of parrafo.split(/\s+/).filter(Boolean)) {
      let p = palabra;
      while (fuente.widthOfTextAtSize(p, tam) > ancho) { // palabra más larga que la columna: se corta
        let n = p.length;
        while (n > 1 && fuente.widthOfTextAtSize(p.slice(0, n), tam) > ancho) n--;
        if (actual) { lineas.push(actual); actual = ""; }
        lineas.push(p.slice(0, n));
        p = p.slice(n);
      }
      const prueba = actual ? `${actual} ${p}` : p;
      if (fuente.widthOfTextAtSize(prueba, tam) <= ancho) actual = prueba;
      else { if (actual) lineas.push(actual); actual = p; }
    }
    lineas.push(actual);
  }
  return lineas.length ? lineas : [""];
}

const texto = (c: string | number | null, f?: string): string => {
  if (c === null) return "";
  if (typeof c === "number") {
    if (f === "porcentaje") return `${c.toLocaleString("es-CO", { maximumFractionDigits: 1 })} %`;
    if (f === "decimal2") return c.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return c.toLocaleString("es-CO", { maximumFractionDigits: 2 });
  }
  return c;
};

export async function aPdf(doc: DocExport): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(limpiar(doc.titulo));
  pdf.setCreator("Plataforma de gestión de proyectos GreenLand");
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  const paginas: PDFPage[] = [];
  let pagina!: PDFPage, y = 0;
  const ANCHO = A4_H[0] - 2 * MARGEN;

  const nueva = () => { pagina = pdf.addPage(A4_H); paginas.push(pagina); y = A4_H[1] - MARGEN; };
  const asegurar = (alto: number) => { if (y - alto < MARGEN + 14) nueva(); };
  nueva();

  pagina.drawText(limpiar(doc.titulo), { x: MARGEN, y: y - 16, size: 16, font: negrita, color: VERDE });
  y -= 24;
  pagina.drawText(limpiar([doc.subtitulo, `Generado: ${doc.generado}`].filter(Boolean).join("  |  ")), { x: MARGEN, y: y - 10, size: 9, font: normal, color: GRIS });
  y -= 22;

  const dibujarTabla = (t: TablaExport) => {
    asegurar(60);
    pagina.drawText(limpiar(t.titulo), { x: MARGEN, y: y - 12, size: 12, font: negrita, color: VERDE });
    y -= 20;
    if (t.nota) {
      for (const l of partir(t.nota, normal, 8.5, ANCHO)) { asegurar(12); pagina.drawText(l, { x: MARGEN, y: y - 9, size: 8.5, font: normal, color: GRIS }); y -= 11; }
      y -= 4;
    }
    // Anchos proporcionales al contenido (con mínimos y máximos razonables)
    const tam = 8;
    const pesos = t.columnas.map((c, i) => {
      const mayor = Math.max(negrita.widthOfTextAtSize(limpiar(c), tam), ...t.filas.map((f) => Math.min(180, normal.widthOfTextAtSize(limpiar(texto(f[i], t.formatoFilas?.[t.filas.indexOf(f)] ?? t.formato?.[i])), tam))));
      return Math.max(38, Math.min(200, mayor + 8));
    });
    const suma = pesos.reduce((a, b) => a + b, 0);
    const anchos = pesos.map((p) => (p / suma) * ANCHO);

    const LINEAS_MAX = Math.floor((A4_H[1] - 2 * MARGEN - 14 - 40) / 10); // líneas que caben en una hoja completa
    const dibujarFila = (lineas: string[][], cabecera: boolean, alineaDerecha: boolean[]) => {
      const alto = Math.max(...lineas.map((l) => l.length)) * 10 + 6;
      asegurar(alto);
      if (cabecera) pagina.drawRectangle({ x: MARGEN, y: y - alto, width: ANCHO, height: alto, color: VERDE });
      else pagina.drawLine({ start: { x: MARGEN, y: y - alto }, end: { x: MARGEN + ANCHO, y: y - alto }, thickness: 0.4, color: rgb(0.86, 0.86, 0.85) });
      let x = MARGEN;
      lineas.forEach((ls, i) => {
        ls.forEach((l, k) => {
          const ancho = (cabecera ? negrita : normal).widthOfTextAtSize(l, tam);
          pagina.drawText(l, { x: alineaDerecha[i] ? x + anchos[i] - 3 - ancho : x + 3, y: y - 9 - k * 10, size: tam, font: cabecera ? negrita : normal, color: cabecera ? rgb(1, 1, 1) : rgb(0.09, 0.27, 0.02) });
        });
        x += anchos[i];
      });
      y -= alto;
    };
    // Una celda con más texto que una hoja se reparte en varias hojas (con la cabecera repetida): no se corta nada.
    const fila = (celdas: string[], cabecera: boolean, alineaDerecha: boolean[]) => {
      const lineas = celdas.map((c, i) => partir(c, cabecera ? negrita : normal, tam, anchos[i] - 6));
      const n = Math.max(...lineas.map((l) => l.length));
      if (n <= LINEAS_MAX) return dibujarFila(lineas, cabecera, alineaDerecha);
      for (let k = 0; k < n; k += LINEAS_MAX) {
        if (k > 0) { nueva(); fila(t.columnas, true, t.columnas.map(() => false)); }
        dibujarFila(lineas.map((l) => { const parte = l.slice(k, k + LINEAS_MAX); return parte.length ? parte : [""]; }), cabecera, alineaDerecha);
      }
    };
    const der = t.columnas.map((_, i) => t.filas.some((f) => typeof f[i] === "number"));
    fila(t.columnas, true, t.columnas.map(() => false));
    if (t.filas.length === 0) { asegurar(14); pagina.drawText("Sin registros.", { x: MARGEN + 3, y: y - 11, size: 9, font: normal, color: GRIS }); y -= 16; }
    for (const f of t.filas) {
      const antes = pagina;
      const celdas = f.map((c, i) => texto(c, t.formatoFilas?.[t.filas.indexOf(f)] ?? t.formato?.[i]));
      // si la fila obliga a cambiar de página, se repite la cabecera
      const lineas = celdas.map((c, i) => partir(c, normal, tam, anchos[i] - 6));
      const alto = Math.max(...lineas.map((l) => l.length)) * 10 + 6;
      if (y - alto < MARGEN + 14 && lineas.every((l) => l.length <= LINEAS_MAX)) { nueva(); fila(t.columnas, true, t.columnas.map(() => false)); }
      void antes;
      fila(celdas, false, der);
    }
    y -= 16;
  };

  for (const t of doc.tablas) dibujarTabla(t);

  paginas.forEach((p, i) => p.drawText(`Página ${i + 1} de ${paginas.length}`, { x: A4_H[0] - MARGEN - 60, y: 18, size: 8, font: normal, color: GRIS }));
  return pdf.save();
}
