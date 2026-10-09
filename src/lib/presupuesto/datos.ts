// Lectura del presupuesto de un proyecto desde Supabase. Se hace con la sesión de quien
// consulta: las reglas de acceso de la base de datos deciden qué filas devuelve.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Capitulo, LineaCosto, Partida } from "./calculos";
import { gastoAMonto } from "./curva";
import { desdeJson, ESCALA } from "./dinero";
import { ErrorDeBase, leerTodo } from "./paginar";

type Numero = number | string;

// Fallo al leer una tabla concreta: permite decir cuál y con qué código, sin exponer el mensaje interno.
export class ErrorLecturaTabla extends Error {
  constructor(
    readonly tabla: string,
    readonly codigo?: string,
    mensaje?: string,
  ) {
    super(mensaje ?? `No se pudo leer ${tabla}`);
    this.name = "ErrorLecturaTabla";
  }
}

async function leerTabla<T>(
  tabla: string,
  pedir: Parameters<typeof leerTodo<T>>[0],
): Promise<T[]> {
  try {
    return await leerTodo<T>(pedir);
  } catch (e) {
    if (e instanceof ErrorDeBase) throw new ErrorLecturaTabla(tabla, e.codigo, e.message);
    throw e;
  }
}

export type DatosPresupuesto = {
  capitulos: Capitulo[];
  partidas: Partida[];
  lineas: LineaCosto[];
  gastoPorMes: Map<number, bigint>; // mes → monto (escala 6)
};

export async function cargarDatosPresupuesto(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<DatosPresupuesto> {
  const [capitulos, partidas, lineas, gastos] = await Promise.all([
    leerTabla<{ id: string; codigo: string; nombre: string; orden: number }>("capitulos", (desde, hasta) =>
      supabase
        .from("capitulos")
        .select("id, codigo, nombre, orden")
        .eq("proyecto_id", proyectoId)
        .order("orden")
        .range(desde, hasta),
    ),
    leerTabla<{
      id: string;
      capitulo_id: string;
      codigo: string;
      descripcion: string;
      unidad: string;
      cantidad: Numero;
      precio_unitario: Numero;
    }>("apu_partidas", (desde, hasta) =>
      supabase
        .from("apu_partidas")
        .select("id, capitulo_id, codigo, descripcion, unidad, cantidad, precio_unitario")
        .eq("proyecto_id", proyectoId)
        .order("id")
        .range(desde, hasta),
    ),
    leerTabla<{
      id: string;
      nombre: string;
      base: "costo_directo" | "linea";
      linea_base_id: string | null;
      porcentaje: Numero;
      orden: number;
    }>("costos_adicionales", (desde, hasta) =>
      supabase
        .from("costos_adicionales")
        .select("id, nombre, base, linea_base_id, porcentaje, orden")
        .eq("proyecto_id", proyectoId)
        .order("orden")
        .range(desde, hasta),
    ),
    leerTabla<{ mes: number; valor_real: Numero }>("gasto_mensual", (desde, hasta) =>
      supabase
        .from("gasto_mensual")
        .select("mes, valor_real")
        .eq("proyecto_id", proyectoId)
        .order("mes")
        .range(desde, hasta),
    ),
  ]);

  return {
    capitulos,
    partidas: partidas.map((p) => ({
      id: p.id,
      capituloId: p.capitulo_id,
      codigo: p.codigo,
      descripcion: p.descripcion,
      unidad: p.unidad,
      cantidad: desdeJson(p.cantidad, ESCALA.cantidad),
      precio: desdeJson(p.precio_unitario, ESCALA.precio),
    })),
    lineas: lineas.map((l) => ({
      id: l.id,
      nombre: l.nombre,
      base: l.base,
      lineaBaseId: l.linea_base_id,
      porcentaje: desdeJson(l.porcentaje, ESCALA.porcentaje),
      orden: l.orden,
    })),
    gastoPorMes: new Map(gastos.map((g) => [g.mes, gastoAMonto(desdeJson(g.valor_real, ESCALA.precio))])),
  };
}
