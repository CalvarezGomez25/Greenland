// Lectura y validación de los datos de un formulario según la definición de sus campos.

import type { CampoDef, Opcion, Valores } from "./tipos";

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export function esFechaValida(t: string): boolean {
  if (!FECHA.test(t)) return false;
  const [a, m, d] = t.split("-").map(Number);
  const f = new Date(Date.UTC(a, m - 1, d));
  return f.getUTCFullYear() === a && f.getUTCMonth() === m - 1 && f.getUTCDate() === d;
}

// Acepta "12,5" o "12.5" (cifras pequeñas: porcentajes, puntajes). No es para dinero.
export function leerDecimalSimple(t: string, decimales: number): number | null {
  const limpio = t.trim().replace(",", ".");
  const re = new RegExp(`^-?\\d{1,12}(\\.\\d{1,${decimales}})?$`);
  return re.test(limpio) ? Number(limpio) : null;
}

export function leerCampos(
  campos: CampoDef[],
  datos: FormData,
  opcionesDinamicas: Record<string, Opcion[]> = {},
  { creando = true }: { creando?: boolean } = {},
): { valores: Valores; error?: string } {
  const valores: Valores = {};
  for (const c of campos) {
    if (c.soloAlCrear && !creando) continue;
    const bruto = datos.get(c.nombre);
    const t = (typeof bruto === "string" ? bruto : "").trim();

    if (c.tipo === "casilla") {
      valores[c.nombre] = datos.get(c.nombre) === "on";
      continue;
    }
    if (t === "") {
      if (c.obligatorio) return { valores, error: `${c.etiqueta} es obligatorio.` };
      valores[c.nombre] = null;
      continue;
    }
    switch (c.tipo) {
      case "texto":
      case "area": {
        const max = c.max ?? (c.tipo === "area" ? 4000 : 200);
        if (t.length > max) return { valores, error: `${c.etiqueta} no puede superar ${max} caracteres.` };
        valores[c.nombre] = t;
        break;
      }
      case "entero": {
        if (!/^-?\d{1,9}$/.test(t)) return { valores, error: `${c.etiqueta} debe ser un número entero.` };
        const n = Number(t);
        if (c.min !== undefined && n < c.min) return { valores, error: `${c.etiqueta} no puede ser menor que ${c.min}.` };
        if (c.max !== undefined && n > c.max) return { valores, error: `${c.etiqueta} no puede ser mayor que ${c.max}.` };
        valores[c.nombre] = n;
        break;
      }
      case "decimal": {
        const n = leerDecimalSimple(t, c.decimales ?? 2);
        if (n === null) return { valores, error: `${c.etiqueta} debe ser un número${c.decimales === 0 ? " entero" : ""} (hasta ${c.decimales ?? 2} decimales).` };
        if (c.min !== undefined && n < c.min) return { valores, error: `${c.etiqueta} no puede ser menor que ${c.min}.` };
        if (c.max !== undefined && n > c.max) return { valores, error: `${c.etiqueta} no puede ser mayor que ${c.max}.` };
        valores[c.nombre] = n;
        break;
      }
      case "fecha":
        if (!esFechaValida(t)) return { valores, error: `${c.etiqueta} no es una fecha válida.` };
        valores[c.nombre] = t;
        break;
      case "seleccion": {
        const ops = c.opciones ?? (c.opcionesDe ? opcionesDinamicas[c.opcionesDe] : undefined) ?? [];
        if (!ops.some((o) => o.valor === t)) return { valores, error: `${c.etiqueta}: elige una opción de la lista.` };
        valores[c.nombre] = t;
        break;
      }
    }
  }
  return { valores };
}
