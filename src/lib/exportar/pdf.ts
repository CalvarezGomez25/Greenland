// PDF de tablas con la identidad de la plataforma (la misma del informe gerencial): logo, tipografías Baloo 2 y Roboto,
// paleta verde, tarjetas de indicadores, etiquetas de semáforo y filas alternadas. Se dibuja con pdf-lib, sin servicios externos.
import { PDFDocument, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { LEMA_PLATAFORMA, NOMBRE_EMPRESA, NOMBRE_PLATAFORMA } from "../marca";
import { BALOO_700, LOGO_PNG, ROBOTO_400, ROBOTO_500 } from "../informe/fuentes";
import { C, Lienzo, hex, limpiar as limpiarMarca, partir as partirMarca, type Fuentes } from "../informe/pdf";
import { TONOS, tonoDeTexto } from "./tonos";
import type { DocExport, TablaExport, Tarjeta } from "./tipos";

const A4_H: [number, number] = [841.89, 595.28]; // horizontal
const M = 34;
const ANCHO = A4_H[0] - 2 * M;
const BASE = A4_H[1] - 46; // hasta aquí llega el contenido; debajo va el pie

// Para fuentes estándar (compatibilidad): sustituye los símbolos que no existen en el alfabeto latino.
export function limpiar(t: string): string {
  return t
    .replace(/[–—]/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, "...")
    .replace(/≥/g, ">=").replace(/≤/g, "<=").replace(/[→↑↓]/g, "").replace(/ /g, " ")
    .replace(/[^\x09\x0A\x0D\x20-\x7E¡-ÿ]/g, "")
    .replace(/ {2,}/g, " ");
}

const texto = (c: string | number | null, f?: string): string => {
  if (c === null) return "—";
  if (typeof c === "number") {
    if (f === "porcentaje") return `${c.toLocaleString("es-CO", { maximumFractionDigits: 1 })} %`;
    if (f === "decimal2") return c.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return c.toLocaleString("es-CO", { maximumFractionDigits: 2 });
  }
  return c === "" ? "—" : c;
};

export async function aPdf(doc: DocExport): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const f: Fuentes = {
    titulo: await pdf.embedFont(Buffer.from(BALOO_700, "base64"), { subset: true }),
    normal: await pdf.embedFont(Buffer.from(ROBOTO_400, "base64"), { subset: true }),
    medio: await pdf.embedFont(Buffer.from(ROBOTO_500, "base64"), { subset: true }),
  };
  const logo = await pdf.embedPng(Buffer.from(LOGO_PNG, "base64"));
  pdf.setTitle(limpiarMarca(doc.titulo));
  pdf.setAuthor(`${NOMBRE_PLATAFORMA} · ${NOMBRE_EMPRESA}`);
  pdf.setCreator(NOMBRE_PLATAFORMA);

  const paginas: PDFPage[] = [];
  let L!: Lienzo, y = 0;

  // ---- Encabezados --------------------------------------------------------------------------------
  const nueva = () => {
    const pagina = pdf.addPage(A4_H);
    paginas.push(pagina);
    L = new Lienzo(pagina, f);
    if (paginas.length === 1) {
      const lh = 30;
      pagina.drawImage(logo, { x: M, y: L.Y(M + lh), width: (lh * logo.width) / logo.height, height: lh });
      L.texto(NOMBRE_PLATAFORMA, A4_H[0] - M, M + 11, { f: f.titulo, tam: 13, color: C.leaf600, derecha: true });
      L.texto(`${NOMBRE_EMPRESA} · ${LEMA_PLATAFORMA}`, A4_H[0] - M, M + 24, { tam: 7.5, color: C.gris, derecha: true });
      L.linea(M, M + 38, A4_H[0] - M, M + 38, C.leaf600, 1);
      pagina.drawRectangle({ x: M, y: L.Y(M + 40.5), width: 70, height: 2.5, color: C.tierra });
      y = M + 66;
      const tam = doc.titulo.length > 60 ? 17 : 21;
      y += L.parrafo(doc.titulo, M, y, { f: f.titulo, tam, ancho: ANCHO, maxLineas: 2, color: C.leaf700, interlinea: tam * 1.05 }) + 4;
      L.texto([doc.subtitulo, `Generado: ${doc.generado}`].filter(Boolean).join("  ·  "), M, y, { tam: 8.5, color: C.gris, ancho: ANCHO });
      y += 18;
    } else {
      const lh = 18;
      pagina.drawImage(logo, { x: M, y: L.Y(M + lh - 4), width: (lh * logo.width) / logo.height, height: lh });
      L.texto(doc.titulo, A4_H[0] - M, M + 6, { f: f.medio, tam: 8, color: C.gris, derecha: true, ancho: ANCHO - 120 });
      L.linea(M, M + 20, A4_H[0] - M, M + 20, C.leaf600, 0.8);
      y = M + 36;
    }
  };
  const asegurar = (alto: number) => { if (y + alto > BASE) nueva(); };
  nueva();

  // ---- Tarjetas de indicadores ----------------------------------------------------------------------
  const dibujarTarjetas = (filas: Tarjeta[][]) => {
    const hT = 54;
    for (const fila of filas) {
      asegurar(hT + 8);
      const w = (ANCHO - (fila.length - 1) * 8) / fila.length;
      fila.forEach((t, k) => {
        const x = M + k * (w + 8);
        const tono = t.tono ? TONOS[t.tono] : null;
        L.caja(x, y, w, hT, { fondo: tono ? hex(tono.fondo) : C.leaf100, borde: tono ? hex(tono.borde) : undefined, radio: 10, grosor: 0.9 });
        const colorTexto = tono ? hex(tono.texto) : C.leaf800;
        L.texto(t.etiqueta.toUpperCase(), x + 10, y + 14, { f: f.medio, tam: 6.8, color: colorTexto, ancho: w - 18 });
        L.texto(t.valor, x + 10, y + 35, { f: f.titulo, tam: 19, color: tono ? hex(tono.texto) : C.leaf700, ancho: w - 18 });
        if (t.detalle) L.texto(t.detalle, x + 10, y + 47, { tam: 7, color: C.gris, ancho: w - 18 });
      });
      y += hT + 8;
    }
    if (doc.notaTarjetas) {
      for (const l of partirMarca(limpiarMarca(doc.notaTarjetas), f.normal, 7.5, ANCHO)) { asegurar(11); L.texto(l, M, y + 8, { tam: 7.5, color: C.gris }); y += 10.5; }
    }
    y += 10;
  };
  if (doc.tarjetas?.length) dibujarTarjetas(doc.tarjetas);

  // ---- Tablas ---------------------------------------------------------------------------------------
  const dibujarTabla = (t: TablaExport) => {
    asegurar(70);
    L.texto(t.titulo, M, y + 11, { f: f.titulo, tam: 12, color: C.leaf700, ancho: ANCHO - 90 });
    L.texto(`${t.filas.length} ${t.filas.length === 1 ? "registro" : "registros"}`, A4_H[0] - M, y + 10, { tam: 7.5, color: C.gris, derecha: true });
    y += 19;
    if (t.nota) {
      for (const l of partirMarca(limpiarMarca(t.nota), f.normal, 7.8, ANCHO)) { asegurar(11); L.texto(l, M, y + 8, { tam: 7.8, color: C.gris }); y += 10.5; }
      y += 3;
    }
    const tam = 7.8, interl = 9.6, padV = 7;
    const fmtDe = (r: number, c: number) => t.formatoFilas?.[r] ?? t.formato?.[c];
    const der = t.columnas.map((_, i) => t.filas.some((fila) => typeof fila[i] === "number"));
    // Anchos proporcionales al contenido (con mínimos y máximos razonables); las cifras llevan más aire entre columnas.
    const pesos = t.columnas.map((c, i) => {
      const mayor = Math.max(
        f.medio.widthOfTextAtSize(limpiarMarca(c), tam),
        ...t.filas.map((fila, r) => Math.min(180, f.normal.widthOfTextAtSize(limpiarMarca(texto(fila[i], fmtDe(r, i)).slice(0, 120)), tam))), // se mide una muestra: medir textos enormes carácter a carácter es lento
      );
      return Math.max(46, Math.min(200, mayor + (der[i] ? 26 : 18)));
    });
    const suma = pesos.reduce((a, b) => a + b, 0);
    const anchos = pesos.map((p) => (p / suma) * ANCHO);
    const LINEAS_MAX = Math.floor((BASE - M - 50) / interl); // líneas que caben en una hoja completa

    const dibujarFila = (lineas: string[][], cabecera: boolean, indice: number) => {
      const alto = Math.max(...lineas.map((l) => l.length)) * interl + padV;
      asegurar(alto);
      if (cabecera) L.caja(M, y, ANCHO, alto, { fondo: C.leaf600, radio: 4 });
      else {
        if (indice % 2 === 1) L.caja(M, y, ANCHO, alto, { fondo: C.leaf50, radio: 0 });
        L.linea(M, y + alto, M + ANCHO, y + alto, C.borde, 0.4);
      }
      let x = M;
      lineas.forEach((ls, i) => {
        const etiqueta = !cabecera && t.insignias?.includes(i) && ls.length === 1 ? tonoDeTexto(ls[0]) : null;
        if (etiqueta) {
          const tono = TONOS[etiqueta];
          const w = Math.min(anchos[i] - 6, f.medio.widthOfTextAtSize(ls[0], 7) + 18);
          const px = der[i] ? x + anchos[i] - 4 - w : x + 4;
          L.caja(px, y + (alto - 13) / 2, w, 13, { fondo: hex(tono.fondo), borde: hex(tono.borde), radio: 6.5, grosor: 0.6 });
          L.punto(px + 7, y + alto / 2, 2.2, hex(tono.punto));
          L.texto(ls[0], px + 12, y + alto / 2 + 2.5, { f: f.medio, tam: 7, color: hex(tono.texto), ancho: w - 15 });
        } else {
          ls.forEach((l, k) => {
            const fuente = cabecera ? f.medio : f.normal;
            const tamano = cabecera ? 7.5 : tam;
            const ancho = fuente.widthOfTextAtSize(limpiarMarca(l), tamano);
            const px = der[i] ? x + anchos[i] - 4 - ancho : x + 4;
            L.texto(l, px, y + 10 + k * interl, { f: fuente, tam: tamano, color: cabecera ? C.hoja : l === "—" ? C.gris : C.leaf900 });
          });
        }
        x += anchos[i];
      });
      y += alto;
    };
    // Una celda con más texto que una hoja se reparte en varias hojas (con la cabecera repetida): no se corta nada.
    const fila = (celdas: string[], cabecera: boolean, indice: number, previas?: string[][]) => {
      const fuente: PDFFont = cabecera ? f.medio : f.normal;
      const lineas = previas ?? celdas.map((c, i) => partirMarca(limpiarMarca(c), fuente, tam, anchos[i] - 8));
      const n = Math.max(...lineas.map((l) => l.length));
      if (n <= LINEAS_MAX) return dibujarFila(lineas, cabecera, indice);
      for (let k = 0; k < n; k += LINEAS_MAX) {
        if (k > 0) { nueva(); fila(t.columnas, true, 0); }
        dibujarFila(lineas.map((l) => { const parte = l.slice(k, k + LINEAS_MAX); return parte.length ? parte : [""]; }), cabecera, indice);
      }
    };
    fila(t.columnas, true, 0);
    if (t.filas.length === 0) { asegurar(16); L.texto("Sin registros.", M + 4, y + 11, { tam: 8.5, color: C.gris }); y += 18; }
    t.filas.forEach((fl, r) => {
      const celdas = fl.map((c, i) => texto(c, fmtDe(r, i)));
      const lineas = celdas.map((c, i) => partirMarca(limpiarMarca(c), f.normal, tam, anchos[i] - 8));
      const alto = Math.max(...lineas.map((l) => l.length)) * interl + padV;
      // si la fila obliga a cambiar de página, se repite la cabecera
      if (y + alto > BASE && lineas.every((l) => l.length <= LINEAS_MAX)) { nueva(); fila(t.columnas, true, 0); }
      fila(celdas, false, r, lineas);
    });
    y += 16;
  };

  for (const t of doc.tablas) if (!t.omitirEnPdf) dibujarTabla(t);

  // ---- Pie de cada página ---------------------------------------------------------------------------
  paginas.forEach((p, i) => {
    const l = new Lienzo(p, f);
    l.linea(M, A4_H[1] - 36, A4_H[0] - M, A4_H[1] - 36, C.borde, 0.6);
    l.texto(`${NOMBRE_PLATAFORMA} · ${NOMBRE_EMPRESA}  |  Documento generado automáticamente con los datos de la plataforma el ${doc.generado}.  Montos en pesos colombianos (COP).`, M, A4_H[1] - 24, { tam: 7, color: C.gris, ancho: ANCHO - 80 });
    l.texto(`Página ${i + 1} de ${paginas.length}`, A4_H[0] - M, A4_H[1] - 24, { tam: 7, color: C.gris, derecha: true });
  });
  return pdf.save();
}
