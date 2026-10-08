// Lectura del presupuesto de un proyecto desde Supabase. Se hace con la sesión de quien
// consulta: las reglas de acceso de la base de datos deciden qué filas devuelve.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Capitulo, LineaCosto, Partida } from "./calculos";
import { gastoAMonto } from "./curva";
import { desdeJson, ESCALA } from "./dinero";
import { leerTodo } from "./paginar";

type Numero = number | string;

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
    leerTodo<{ id: string; codigo: string; nombre: string; orden: number }>((desde, hasta) =>
      supabase
        .from("capitulos")
        .select("id, codigo, nombre, orden")
        .eq("proyecto_id", proyectoId)
        .order("orden")
        .range(desde, hasta),
    ),
    leerTodo<{
      id: string;
      capitulo_id: string;
      codigo: string;
      descripcion: string;
      unidad: string;
      cantidad: Numero;
      precio_unitario: Numero;
    }>((desde, hasta) =>
      supabase
        .from("apu_partidas")
        .select("id, capitulo_id, codigo, descripcion, unidad, cantidad, precio_unitario")
        .eq("proyecto_id", proyectoId)
        .order("id")
        .range(desde, hasta),
    ),
    leerTodo<{
      id: string;
      nombre: string;
      base: "costo_directo" | "linea";
      linea_base_id: string | null;
      porcentaje: Numero;
      orden: number;
    }>((desde, hasta) =>
      supabase
        .from("costos_adicionales")
        .select("id, nombre, base, linea_base_id, porcentaje, orden")
        .eq("proyecto_id", proyectoId)
        .order("orden")
        .range(desde, hasta),
    ),
    leerTodo<{ mes: number; valor_real: Numero }>((desde, hasta) =>
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
