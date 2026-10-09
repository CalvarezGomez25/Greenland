// Convierte una fila del registro de cambios (lo que guarda la base de datos) en un texto
// legible: qué pasó y qué valores cambiaron. No toca la base de datos.

import { ESCALA, desdeJson, formatearDecimal, formatearPesos } from "./dinero";

export type EntidadCambio = "partida" | "capitulo" | "costo_adicional" | "gasto_mensual" | "importacion";
export type OperacionCambio = "crear" | "editar" | "borrar" | "importar";
type Campos = Record<string, unknown> | null;

export type CambioFila = {
  id: number;
  fecha: string;
  usuario_nombre: string | null;
  entidad: EntidadCambio;
  operacion: OperacionCambio;
  registro_id: string | null;
  antes: Campos;
  despues: Campos;
  motivo: string | null;
};

export type CambioDescrito = { titulo: string; detalles: string[] };

type Formato = (valor: unknown) => string;
type CampoDescrito = { clave: string; etiqueta: string; formato: Formato };

const texto: Formato = (v) => (v === null || v === undefined || v === "" ? "—" : String(v));

function conEscala(valor: unknown, escala: number, alFormatear: (v: bigint) => string): string {
  try {
    return alFormatear(desdeJson(valor as number | string, escala));
  } catch {
    return texto(valor); // si el dato no se puede leer con seguridad, se muestra tal cual
  }
}
const numero = (escala: number): Formato => (v) => conEscala(v, escala, (x) => formatearDecimal(x, escala));
const pesos = (escala: number): Formato => (v) =>
  conEscala(v, escala, (x) => `$ ${formatearPesos(x * 10n ** BigInt(ESCALA.monto - escala))}`);

const CAMPOS_PARTIDA: CampoDescrito[] = [
  { clave: "codigo", etiqueta: "Código", formato: texto },
  { clave: "descripcion", etiqueta: "Descripción", formato: texto },
  { clave: "unidad", etiqueta: "Unidad", formato: texto },
  { clave: "cantidad", etiqueta: "Cantidad", formato: numero(ESCALA.cantidad) },
  { clave: "precio_unitario", etiqueta: "Precio unitario", formato: numero(ESCALA.precio) },
];

const CAMPOS_COSTO: CampoDescrito[] = [
  { clave: "nombre", etiqueta: "Nombre", formato: texto },
  { clave: "porcentaje", etiqueta: "Porcentaje", formato: (v) => `${numero(ESCALA.porcentaje)(v)} %` },
  { clave: "base", etiqueta: "Se calcula sobre", formato: (v) => (v === "costo_directo" ? "Costo directo" : "Otra línea") },
];

const mismo = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function diferencias(antes: Campos, despues: Campos, campos: CampoDescrito[]): string[] {
  if (!antes || !despues) return [];
  return campos
    .filter((c) => !mismo(antes[c.clave], despues[c.clave]))
    .map((c) => `${c.etiqueta}: ${c.formato(antes[c.clave])} → ${c.formato(despues[c.clave])}`);
}

function valores(fila: Campos, campos: CampoDescrito[]): string[] {
  if (!fila) return [];
  return campos.filter((c) => c.clave !== "nombre").map((c) => `${c.etiqueta}: ${c.formato(fila[c.clave])}`);
}

function resumenImportacion(r: Campos): string {
  if (!r) return "—";
  const monto = conEscala(r.costo_directo, ESCALA.monto, (x) => `$ ${formatearPesos(x)}`);
  return `${texto(r.partidas)} partidas en ${texto(r.capitulos)} capítulos, costo directo ${monto}`;
}

export function describirCambio(c: CambioFila): CambioDescrito {
  const ref = c.despues ?? c.antes;
  const verbo = { crear: "creada", editar: "editada", borrar: "eliminada", importar: "importada" }[c.operacion];
  const verboM = { crear: "creado", editar: "editado", borrar: "eliminado", importar: "importado" }[c.operacion];

  switch (c.entidad) {
    case "importacion":
      return {
        titulo: "Presupuesto importado desde un archivo",
        detalles: [`Antes: ${resumenImportacion(c.antes)}`, `Después: ${resumenImportacion(c.despues)}`],
      };

    case "partida": {
      const titulo = `Partida ${verbo}: ${texto(ref?.codigo)} — ${texto(ref?.descripcion)}`;
      if (c.operacion === "editar") {
        const lista = diferencias(c.antes, c.despues, CAMPOS_PARTIDA);
        if (c.antes && c.despues && !mismo(c.antes.capitulo_id, c.despues.capitulo_id)) lista.push("Cambió de capítulo");
        return { titulo, detalles: lista };
      }
      return { titulo, detalles: valores(ref ?? null, CAMPOS_PARTIDA.filter((x) => x.clave !== "codigo" && x.clave !== "descripcion")) };
    }

    case "capitulo":
      return { titulo: `Capítulo ${verboM}: ${texto(ref?.nombre)}`, detalles: [] };

    case "costo_adicional": {
      const titulo = `Costo adicional ${verboM}: ${texto(ref?.nombre)}`;
      if (c.operacion === "editar") {
        const lista = diferencias(c.antes, c.despues, CAMPOS_COSTO);
        if (c.antes && c.despues && !mismo(c.antes.linea_base_id, c.despues.linea_base_id)) lista.push("Cambió la línea base");
        return { titulo, detalles: lista };
      }
      return { titulo, detalles: valores(ref ?? null, CAMPOS_COSTO) };
    }

    case "gasto_mensual": {
      const mes = texto(ref?.mes);
      const formato = pesos(ESCALA.precio);
      if (c.operacion === "editar") {
        return {
          titulo: `Gasto del mes ${mes} corregido`,
          detalles: [`Valor: ${formato(c.antes?.valor_real)} → ${formato(c.despues?.valor_real)}`],
        };
      }
      return {
        titulo: `Gasto del mes ${mes} ${c.operacion === "crear" ? "registrado" : "eliminado"}`,
        detalles: [`Valor: ${formato(ref?.valor_real)}`],
      };
    }
  }
}
