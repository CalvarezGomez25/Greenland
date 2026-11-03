// Combinación de correspondencia de un archivo Word (.docx) sin salir del servidor.
// Reemplaza los campos de combinación simples (MERGEFIELD) de cada parte del documento (cuerpo, encabezados y pies) por texto.
// Un campo sin valor se imprime como «[POR COMPLETAR]», nunca vacío. Los saltos de línea del valor pasan a saltos de línea de Word.
// Los archivos .docx son zip: se limita su tamaño y la cantidad de partes para no abrir archivos maliciosos.

import JSZip from "jszip";

export const POR_COMPLETAR = "[POR COMPLETAR]";
const LIMITE_ZIP = 8 * 1024 * 1024; // bytes del archivo
const LIMITE_DESCOMPRIMIDO = 60 * 1024 * 1024;
const LIMITE_PARTES = 500;
const PARTES_CON_CAMPOS = /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/;
const CAMPO_SIMPLE = /<w:fldSimple\b[^>]*\bw:instr="\s*MERGEFIELD\s+([A-Za-z0-9_]+)[^"]*"[^>]*>([\s\S]*?)<\/w:fldSimple>/g;

const escapar = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const limpiar = (t: string) => t.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

async function abrir(contenido: Uint8Array | ArrayBuffer | Buffer): Promise<JSZip> {
  const bytes = contenido instanceof ArrayBuffer ? contenido.byteLength : contenido.length;
  if (bytes > LIMITE_ZIP) throw new Error("El archivo Word es demasiado grande (máximo 8 MB).");
  const zip = await JSZip.loadAsync(contenido);
  const partes = Object.values(zip.files);
  if (partes.length > LIMITE_PARTES) throw new Error("El archivo Word tiene demasiadas partes.");
  // @ts-expect-error _data es interno de JSZip pero trae el tamaño sin descomprimir
  const total = partes.reduce((t, f) => t + (f._data?.uncompressedSize ?? 0), 0);
  if (total > LIMITE_DESCOMPRIMIDO) throw new Error("El archivo Word ocupa demasiado al descomprimirse.");
  if (!zip.file("word/document.xml")) throw new Error("El archivo no es un documento de Word (.docx).");
  return zip;
}

// Nombres de los campos de combinación que trae un archivo, sin repetir y en orden de aparición.
export async function camposDeDocx(contenido: Uint8Array | ArrayBuffer | Buffer): Promise<{ campos: string[]; noSoportados: number }> {
  const zip = await abrir(contenido);
  const vistos = new Set<string>();
  let total = 0, simples = 0;
  for (const nombre of Object.keys(zip.files).filter((n) => PARTES_CON_CAMPOS.test(n))) {
    const xml = await zip.file(nombre)!.async("string");
    total += (xml.match(/MERGEFIELD/g) ?? []).length;
    for (const m of xml.matchAll(CAMPO_SIMPLE)) { vistos.add(m[1].toUpperCase()); simples++; }
  }
  return { campos: [...vistos], noSoportados: Math.max(0, total - simples) };
}

function reemplazo(propiedades: string, valor: string): string {
  const lineas = limpiar(valor).split(/\r?\n/);
  const runs = lineas.map((l, i) => `${i > 0 ? "<w:br/>" : ""}<w:t xml:space="preserve">${escapar(l)}</w:t>`).join("");
  return `<w:r>${propiedades}${runs}</w:r>`;
}

export type ResultadoCombinacion = { archivo: Buffer; faltantes: string[]; noSoportados: number };

// Combina el archivo con los valores (clave en mayúsculas). Los campos sin valor quedan como «[POR COMPLETAR]» y se listan en `faltantes`.
export async function combinarDocx(contenido: Uint8Array | ArrayBuffer | Buffer, valores: Record<string, string | null | undefined>): Promise<ResultadoCombinacion> {
  const zip = await abrir(contenido);
  const faltantes = new Set<string>();
  let total = 0, simples = 0;
  for (const nombre of Object.keys(zip.files).filter((n) => PARTES_CON_CAMPOS.test(n))) {
    const xml = await zip.file(nombre)!.async("string");
    total += (xml.match(/MERGEFIELD/g) ?? []).length;
    const nuevo = xml.replace(CAMPO_SIMPLE, (_t, campo: string, interior: string) => {
      simples++;
      const clave = campo.toUpperCase();
      const v = valores[clave];
      const propiedades = /<w:rPr>[\s\S]*?<\/w:rPr>/.exec(interior)?.[0] ?? "";
      if (v === undefined || v === null || String(v).trim() === "") { faltantes.add(clave); return reemplazo(propiedades, POR_COMPLETAR); }
      return reemplazo(propiedades, String(v));
    });
    if (nuevo !== xml) zip.file(nombre, nuevo);
  }
  const archivo = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return { archivo, faltantes: [...faltantes], noSoportados: Math.max(0, total - simples) };
}
