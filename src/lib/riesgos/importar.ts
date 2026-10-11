// Lectura de un registro de riesgos en Excel (hoja «Registro») y paso a los campos de la plataforma.
// Función pura: recibe las filas ya leídas (texto/fechas) y devuelve riesgos válidos y errores por fila.

export type RiesgoImportado = {
  codigo: string;
  frente: string | null;
  categoria: string;
  descripcion: string;
  causa: string | null;
  consecuencia: string | null;
  probabilidad: number;
  impacto: number;
  plan_accion: string | null;
  momento_control: string | null;
  responsable: string | null;
  fecha_objetivo: string | null; // AAAA-MM-DD
  estado: "activo" | "materializado" | "cerrado";
  referencia: string | null;
};

export type ErrorFila = { fila: number | null; mensaje: string };
export type LecturaRiesgos = { riesgos: RiesgoImportado[]; errores: ErrorFila[]; avisos: string[]; filasLeidas: number };
export type Celda = string | number | Date | null | undefined;

// Escala del Excel (Baja/Media/Alta) → escala 1 a 5 de la plataforma. Con los cortes de la plataforma
// (Crítico ≥ 15, Alto ≥ 8, Medio ≥ 4) estos tres valores reproducen exactamente la matriz 3×3 del Excel.
export const ESCALA_TEXTO: Record<string, number> = { baja: 1, media: 2, alta: 4 };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

const ENCABEZADOS: Record<string, string> = {
  id: "codigo", codigo: "codigo",
  frente: "frente",
  categoria: "categoria",
  riesgo: "descripcion", descripcion: "descripcion",
  "causa / disparador": "causa", causa: "causa",
  consecuencia: "consecuencia",
  probabilidad: "probabilidad",
  impacto: "impacto",
  nivel: "nivel",
  puntaje: "puntaje",
  "mitigacion / accion": "plan_accion", mitigacion: "plan_accion",
  "momento de control": "momento_control",
  "responsable (rol propuesto)": "rol",
  "responsable (nombre)": "nombre",
  responsable: "nombre",
  "fecha objetivo": "fecha_objetivo",
  estado: "estado",
  "base / referencia": "referencia", referencia: "referencia",
};

const OBLIGATORIAS = ["codigo", "categoria", "descripcion", "probabilidad", "impacto"];

function texto(c: Celda): string {
  if (c === null || c === undefined) return "";
  if (c instanceof Date) return fechaIso(c) ?? "";
  return String(c).trim();
}

function fechaIso(d: Date): string | null {
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function leerFecha(c: Celda): { valor: string | null; error?: string } {
  if (c === null || c === undefined || c === "") return { valor: null };
  if (c instanceof Date) {
    const v = fechaIso(c);
    return v ? { valor: v } : { valor: null, error: "fecha no válida" };
  }
  const t = String(c).trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (!m) {
    const d = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(t); // día/mes/año (formato colombiano)
    if (d) m = [t, d[3], d[2].padStart(2, "0"), d[1].padStart(2, "0")] as unknown as RegExpExecArray;
  }
  if (!m) return { valor: null, error: `fecha «${t}» no reconocida (usa AAAA-MM-DD o DD/MM/AAAA)` };
  const f = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (f.getUTCFullYear() !== Number(m[1]) || f.getUTCMonth() !== Number(m[2]) - 1 || f.getUTCDate() !== Number(m[3])) {
    return { valor: null, error: `la fecha «${t}» no existe` };
  }
  return { valor: `${m[1]}-${m[2]}-${m[3]}` };
}

function leerEscala(c: Celda): number | null {
  const t = norm(texto(c));
  if (t in ESCALA_TEXTO) return ESCALA_TEXTO[t];
  if (/^[1-5]$/.test(t)) return Number(t);
  return null;
}

const ESTADOS: Record<string, RiesgoImportado["estado"]> = {
  abierto: "activo", activo: "activo", materializado: "materializado", cerrado: "cerrado",
};

export function nivelDeScore(score: number, cortes = { critico: 15, alto: 8, medio: 4 }): "Crítico" | "Alto" | "Medio" | "Bajo" {
  return score >= cortes.critico ? "Crítico" : score >= cortes.alto ? "Alto" : score >= cortes.medio ? "Medio" : "Bajo";
}

export const MAX_RIESGOS = 500;

export function interpretarRiesgos(filas: Celda[][]): LecturaRiesgos {
  const errores: ErrorFila[] = [];
  const avisos: string[] = [];
  const riesgos: RiesgoImportado[] = [];
  if (filas.length === 0) return { riesgos, errores: [{ fila: null, mensaje: "La hoja está vacía." }], avisos, filasLeidas: 0 };

  const col: Record<string, number> = {};
  filas[0].forEach((c, i) => {
    const clave = ENCABEZADOS[norm(texto(c))];
    if (clave && !(clave in col)) col[clave] = i;
  });
  const faltan = OBLIGATORIAS.filter((k) => !(k in col));
  if (faltan.length) {
    const nombres: Record<string, string> = { codigo: "ID", categoria: "Categoría", descripcion: "Riesgo", probabilidad: "Probabilidad", impacto: "Impacto" };
    return { riesgos, errores: [{ fila: 1, mensaje: `Faltan columnas en el encabezado: ${faltan.map((k) => nombres[k]).join(", ")}.` }], avisos, filasLeidas: 0 };
  }

  const dato = (f: Celda[], k: string) => (k in col ? texto(f[col[k]]) : "");
  const vistos = new Set<string>();
  let leidas = 0;
  let sinNombre = 0;
  let nivelDistinto = 0;

  for (let i = 1; i < filas.length; i++) {
    const f = filas[i];
    if (f.every((c) => texto(c) === "")) continue;
    leidas++;
    const n = i + 1; // número de fila en Excel
    const mal = (m: string) => errores.push({ fila: n, mensaje: m });

    const codigo = dato(f, "codigo");
    if (!codigo) { mal("falta el ID del riesgo."); continue; }
    if (codigo.length > 30) { mal("el ID supera 30 caracteres."); continue; }
    if (vistos.has(codigo)) { mal(`el ID «${codigo}» está repetido en el archivo.`); continue; }
    vistos.add(codigo);

    const categoria = dato(f, "categoria");
    const descripcion = dato(f, "descripcion");
    if (!categoria) { mal(`${codigo}: falta la categoría.`); continue; }
    if (categoria.length > 100) { mal(`${codigo}: la categoría supera 100 caracteres.`); continue; }
    if (!descripcion) { mal(`${codigo}: falta la descripción del riesgo.`); continue; }
    if (descripcion.length > 4000) { mal(`${codigo}: la descripción supera 4.000 caracteres.`); continue; }

    const p = leerEscala(f[col.probabilidad]);
    const im = leerEscala(f[col.impacto]);
    if (p === null) { mal(`${codigo}: probabilidad «${dato(f, "probabilidad")}» no válida (Baja, Media, Alta o un número de 1 a 5).`); continue; }
    if (im === null) { mal(`${codigo}: impacto «${dato(f, "impacto")}» no válido (Baja, Media, Alta o un número de 1 a 5).`); continue; }

    const fecha = leerFecha("fecha_objetivo" in col ? f[col.fecha_objetivo] : null);
    if (fecha.error) { mal(`${codigo}: ${fecha.error}.`); continue; }

    const estadoTxt = norm(dato(f, "estado"));
    let estado: RiesgoImportado["estado"] = "activo";
    if (estadoTxt) {
      if (!(estadoTxt in ESTADOS)) { mal(`${codigo}: estado «${dato(f, "estado")}» no válido (Abierto, Materializado o Cerrado).`); continue; }
      estado = ESTADOS[estadoTxt];
    }

    const nombre = dato(f, "nombre");
    const rol = dato(f, "rol");
    if (!nombre && rol) sinNombre++;
    const responsable = (nombre || rol) || null;
    if (responsable && responsable.length > 200) { mal(`${codigo}: el responsable supera 200 caracteres.`); continue; }

    const plan = dato(f, "plan_accion");
    if (plan.length > 4000) { mal(`${codigo}: el plan de acción supera 4.000 caracteres.`); continue; }
    for (const [k, etiqueta, max] of [["causa", "causa", 2000], ["consecuencia", "consecuencia", 2000], ["momento_control", "momento de control", 60], ["referencia", "referencia", 1000], ["frente", "frente", 120]] as const) {
      if (dato(f, k).length > max) { mal(`${codigo}: ${etiqueta} supera ${max} caracteres.`); }
    }
    if (errores.some((e) => e.fila === n)) continue;

    // Verificación cruzada: el nivel que trae el archivo debe coincidir con el que calcula la plataforma.
    const nivelArchivo = norm(dato(f, "nivel"));
    if (nivelArchivo && nivelArchivo !== norm(nivelDeScore(p * im))) nivelDistinto++;

    riesgos.push({
      codigo, categoria, descripcion,
      frente: dato(f, "frente") || null,
      causa: dato(f, "causa") || null,
      consecuencia: dato(f, "consecuencia") || null,
      probabilidad: p, impacto: im,
      plan_accion: plan || null,
      momento_control: dato(f, "momento_control") || null,
      responsable,
      fecha_objetivo: fecha.valor,
      estado,
      referencia: dato(f, "referencia") || null,
    });
  }

  if (leidas > MAX_RIESGOS) errores.push({ fila: null, mensaje: `Se admiten como máximo ${MAX_RIESGOS} riesgos por archivo (el archivo trae ${leidas}).` });
  if (sinNombre > 0) avisos.push(`${sinNombre} riesgos no traen nombre de responsable: se guardó el rol propuesto como responsable. Puedes cambiarlo después por el nombre.`);
  if (nivelDistinto > 0) avisos.push(`${nivelDistinto} riesgos tienen en el archivo un nivel distinto al que calcula la plataforma; prevalece el cálculo de la plataforma.`);
  return { riesgos, errores, avisos, filasLeidas: leidas };
}
