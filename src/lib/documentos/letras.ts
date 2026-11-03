// Números y fechas en letras para los documentos (español de Colombia). Funciones puras.

const UNIDADES = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve", "veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve"];
const DECENAS = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const CENTENAS = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];

// 0 a 999. `apocopa` cambia «uno» por «un» (y «veintiuno» por «veintiún») cuando va antes de un sustantivo (mil, millones, pesos).
function menorDeMil(n: number, apocopa: boolean): string {
  if (n === 0) return "";
  if (n === 100) return "cien";
  const c = Math.floor(n / 100), r = n % 100;
  const partes: string[] = [];
  if (c > 0) partes.push(CENTENAS[c]);
  if (r > 0) {
    if (r < 30) partes.push(UNIDADES[r]);
    else {
      const d = Math.floor(r / 10), u = r % 10;
      partes.push(u === 0 ? DECENAS[d] : `${DECENAS[d]} y ${UNIDADES[u]}`);
    }
  }
  let t = partes.join(" ");
  if (apocopa) t = t.replace(/veintiuno$/, "veintiún").replace(/ uno$/, " un").replace(/^uno$/, "un");
  return t;
}

// Entero no negativo en letras, hasta 999 billones. Con `sustantivo` (por ejemplo «pesos») usa «un»/«veintiún» al final.
export function numeroALetras(n: bigint, sustantivo = false): string {
  if (n < 0n) return `menos ${numeroALetras(-n, sustantivo)}`;
  if (n === 0n) return "cero";
  if (n >= 1_000_000_000_000_000n) throw new Error("Número demasiado grande para escribirlo en letras.");
  const grupos: number[] = [];
  let x = n;
  while (x > 0n) { grupos.push(Number(x % 1000n)); x /= 1000n; } // [unidades, miles, millones, miles de millones, billones]
  return reconstruir(grupos, sustantivo);
}

// Arma el texto a partir de los grupos de tres cifras; maneja «mil millones» y «billones» correctamente.
function reconstruir(g: number[], sustantivo: boolean): string {
  const millonesTotales = (g[2] ?? 0) + (g[3] ?? 0) * 1000; // millones (0 a 999.999)
  const billones = g[4] ?? 0;
  const resto = (g[1] ?? 0) * 1000 + (g[0] ?? 0); // 0 a 999.999
  const partes: string[] = [];
  if (billones > 0) partes.push(billones === 1 ? "un billón" : `${menorDeMil(billones, true)} billones`);
  if (millonesTotales > 0) partes.push(millonesTotales === 1 ? "un millón" : `${bajoMillon(millonesTotales, true)} millones`);
  if (resto > 0) partes.push(bajoMillon(resto, sustantivo));
  return partes.join(" ");
}

// 1 a 999.999
function bajoMillon(n: number, apocopa: boolean): string {
  const miles = Math.floor(n / 1000), r = n % 1000;
  const p: string[] = [];
  if (miles > 0) p.push(miles === 1 ? "mil" : `${menorDeMil(miles, true)} mil`);
  if (r > 0) p.push(menorDeMil(r, apocopa));
  return p.join(" ");
}

// «mil novecientos seis millones quinientos cuarenta y ocho mil pesos colombianos» (con «de» si son millones exactos).
export function pesosEnLetras(enteros: bigint): string {
  const texto = numeroALetras(enteros, true);
  const de = enteros >= 1_000_000n && enteros % 1_000_000n === 0n ? " de" : "";
  const cap = texto.charAt(0).toUpperCase() + texto.slice(1);
  return `${cap}${de} pesos colombianos`;
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const mesEnLetras = (m: number) => MESES[m - 1] ?? "";

// 2026-11-03 → «3 de noviembre de 2026». Devuelve null si la fecha no es válida.
export function fechaEnLetras(iso: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!m) return null;
  const mes = Number(m[2]);
  if (mes < 1 || mes > 12) return null;
  return `${Number(m[3])} de ${MESES[mes - 1]} de ${m[1]}`;
}

// «ocho (8) meses»: número en letras seguido del número entre paréntesis.
export const cantidadConLetras = (n: number, unidad: string) => `${numeroALetras(BigInt(n), true).replace(/ un$/, " un")} (${n}) ${unidad}`;
