// Lectura del CSV de presupuesto: capítulo, código, descripción, unidad, cantidad,
// precio unitario. Acepta separador ";" "," o tabulador, comillas, encabezado opcional y
// números en formato colombiano (punto de miles, coma decimal: 1.234,56).
//
// Regla de los números: el punto SIEMPRE es separador de miles y la coma es el decimal.
// Un valor como "1234.56" (punto decimal al estilo inglés) se RECHAZA con un mensaje en
// vez de adivinar, porque leerlo como 123456 sería un error silencioso de dinero.

export const MAX_FILAS_IMPORTACION = 5000;
export const MAX_CARACTERES_IMPORTACION = 2_000_000;
const COLUMNAS = 6;

export type Separador = ";" | "," | "\t";

// Fila lista para enviar a la base de datos: los números van como texto con punto decimal.
export type FilaImportada = {
  fila: number; // número de fila en el archivo (el encabezado cuenta como fila 1)
  capitulo: string;
  codigo: string;
  descripcion: string;
  unidad: string;
  cantidad: string;
  precio_unitario: string;
};

export type ErrorImportacion = { fila: number | null; mensaje: string };

export type ResultadoCsv = {
  filas: FilaImportada[];
  errores: ErrorImportacion[];
  separador: Separador;
  encabezado: boolean;
  filasLeidas: number; // filas de datos con contenido (sin encabezado ni líneas vacías)
};

const quitarAcentos = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function detectarSeparador(texto: string): Separador {
  const cuenta: Record<Separador, number> = { ";": 0, "\t": 0, ",": 0 };
  let entreComillas = false;
  for (const c of texto) {
    if (c === '"') entreComillas = !entreComillas;
    else if (!entreComillas) {
      if (c === "\n" || c === "\r") {
        if (cuenta[";"] + cuenta["\t"] + cuenta[","] > 0) break; // primera línea con contenido
      } else if (c === ";" || c === "\t" || c === ",") cuenta[c]++;
    }
  }
  // en empate gana ";" y luego tabulador
  return ([";", "\t", ","] as Separador[]).reduce((mejor, s) => (cuenta[s] > cuenta[mejor] ? s : mejor), ";");
}

function dividirRegistros(texto: string, separador: Separador) {
  const registros: string[][] = [];
  let fila: string[] = [];
  let campo = "";
  let entreComillas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i++;
        } else entreComillas = false;
      } else campo += c;
    } else if (c === '"' && campo === "") {
      entreComillas = true;
    } else if (c === separador) {
      fila.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      fila.push(campo);
      registros.push(fila);
      fila = [];
      campo = "";
    } else campo += c;
  }
  if (campo !== "" || fila.length > 0) {
    fila.push(campo);
    registros.push(fila);
  }
  return { registros, comillasSinCerrar: entreComillas };
}

const esEncabezado = (celdas: string[]) =>
  quitarAcentos(celdas[0] ?? "") === "capitulo" || quitarAcentos(celdas[1] ?? "") === "codigo";

type Numero = { ok: true; valor: string } | { ok: false; motivo: string };

// "1.234,56" → "1234.56". Devuelve el motivo del rechazo si no es válido.
export function leerNumeroColombiano(texto: string, maxDecimales: number, maxEnteros: number): Numero {
  const t = texto.trim().replace(/\s+/g, "").replace(/^\$/, "");
  if (t === "") return { ok: false, motivo: "no tiene valor" };
  if (/^-|^\(.*\)$/.test(t)) return { ok: false, motivo: "no puede ser negativo" };
  if (/[^\d.,]/.test(t)) return { ok: false, motivo: "no es un número" };

  const m = /^([1-9]\d{0,2}(?:\.\d{3})+|\d+)(?:,(\d+))?$/.exec(t);
  if (!m) {
    return {
      ok: false,
      motivo: "tiene un formato no reconocido (usa punto para los miles y coma para los decimales, por ejemplo 1.234,56)",
    };
  }
  const entero = m[1].replace(/\./g, "").replace(/^0+(?=\d)/, "");
  const decimales = m[2] ?? "";
  if (decimales.length > maxDecimales) {
    return { ok: false, motivo: `tiene más de ${maxDecimales} decimales` };
  }
  if (entero.length > maxEnteros) return { ok: false, motivo: "es demasiado grande" };
  return { ok: true, valor: decimales ? `${entero}.${decimales}` : entero };
}

type ResultadoFila = { fila: FilaImportada } | { mensaje: string };

function validarFila(celdas: string[], numeroFila: number): ResultadoFila {
  if (celdas.length < COLUMNAS) {
    return { mensaje: `Faltan columnas: se esperaban ${COLUMNAS} y la fila tiene ${celdas.length}.` };
  }
  if (celdas.slice(COLUMNAS).some((c) => c.trim() !== "")) {
    return { mensaje: `Sobran columnas: se esperaban ${COLUMNAS} y la fila tiene ${celdas.length}.` };
  }
  const [capitulo, codigo, descripcion, unidad, cantidadTxt, precioTxt] = celdas.map((c) => c.trim());

  const texto = (valor: string, falta: string, sujeto: string, maximo: number) =>
    valor === ""
      ? `Falta ${falta}.`
      : valor.length > maximo
        ? `${sujeto} supera ${maximo} caracteres.`
        : null;

  const problema =
    texto(capitulo, "el capítulo", "El capítulo", 120) ??
    texto(codigo, "el código", "El código", 40) ??
    texto(descripcion, "la descripción", "La descripción", 300) ??
    texto(unidad, "la unidad", "La unidad", 20);
  if (problema) return { mensaje: problema };

  const cantidad = leerNumeroColombiano(cantidadTxt, 4, 14);
  if (!cantidad.ok) return { mensaje: `La cantidad ${cantidad.motivo}.` };
  const precio = leerNumeroColombiano(precioTxt, 2, 16);
  if (!precio.ok) return { mensaje: `El precio unitario ${precio.motivo}.` };

  return {
    fila: {
      fila: numeroFila,
      capitulo,
      codigo,
      descripcion,
      unidad,
      cantidad: cantidad.valor,
      precio_unitario: precio.valor,
    },
  };
}

export function leerCsvPresupuesto(textoOriginal: string): ResultadoCsv {
  const vacio = (errores: ErrorImportacion[], separador: Separador = ";", encabezado = false): ResultadoCsv => ({
    filas: [],
    errores,
    separador,
    encabezado,
    filasLeidas: 0,
  });

  const texto = textoOriginal.replace(/^﻿/, "");
  if (texto.length > MAX_CARACTERES_IMPORTACION) {
    return vacio([{ fila: null, mensaje: "El archivo supera el tamaño máximo de 2 MB." }]);
  }
  if (texto.trim() === "") return vacio([{ fila: null, mensaje: "El archivo está vacío." }]);

  const separador = detectarSeparador(texto);
  const { registros, comillasSinCerrar } = dividirRegistros(texto, separador);
  const errores: ErrorImportacion[] = [];
  if (comillasSinCerrar) {
    errores.push({ fila: null, mensaje: "Hay una comilla sin cerrar en el archivo; revisa el texto entre comillas." });
  }

  const encabezado = registros.length > 0 && esEncabezado(registros[0]);
  const datos = registros
    .map((celdas, i) => ({ celdas, fila: i + 1 }))
    .filter((r, i) => !(encabezado && i === 0))
    .filter((r) => r.celdas.some((c) => c.trim() !== ""));

  if (datos.length === 0) {
    return vacio([...errores, { fila: null, mensaje: "El archivo no tiene filas de datos." }], separador, encabezado);
  }
  if (datos.length > MAX_FILAS_IMPORTACION) {
    return {
      ...vacio(
        [...errores, { fila: null, mensaje: `El archivo tiene ${datos.length} filas; el máximo es ${MAX_FILAS_IMPORTACION}.` }],
        separador,
        encabezado,
      ),
      filasLeidas: datos.length,
    };
  }

  const filas: FilaImportada[] = [];
  const primeraVezDelCodigo = new Map<string, number>();
  for (const { celdas, fila } of datos) {
    const resultado = validarFila(celdas, fila);
    const codigo = (celdas[1] ?? "").trim();

    let mensaje = "mensaje" in resultado ? resultado.mensaje : null;
    if (codigo !== "") {
      const anterior = primeraVezDelCodigo.get(codigo);
      if (anterior === undefined) primeraVezDelCodigo.set(codigo, fila);
      else if (mensaje === null) mensaje = `El código "${codigo}" está repetido (ya aparece en la fila ${anterior}).`;
    }

    if (mensaje !== null) errores.push({ fila, mensaje });
    else if ("fila" in resultado) filas.push(resultado.fila);
  }

  errores.sort((a, b) => (a.fila ?? 0) - (b.fila ?? 0));
  return { filas, errores, separador, encabezado, filasLeidas: datos.length };
}
