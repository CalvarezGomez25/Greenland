// Tareas del cronograma (hito 6).
import type { SupabaseClient } from "@supabase/supabase-js";
import { refrescarMedicion } from "@/lib/obra/refrescar";
import type { Definicion } from "../tipos";

export const TAREAS: Definicion = {
  clave: "tareas",
  tabla: "tareas",
  titulo: "Tareas del cronograma",
  singular: "tarea",
  regreso: "cronograma",
  campos: [
    { nombre: "nombre", etiqueta: "Nombre de la tarea", tipo: "texto", obligatorio: true, max: 200 },
    { nombre: "semana_inicio", etiqueta: "Semana de inicio (1 = primera semana del proyecto)", tipo: "entero", obligatorio: true, min: 1, max: 1000 },
    { nombre: "duracion_semanas", etiqueta: "Duración (semanas)", tipo: "entero", obligatorio: true, min: 1, max: 1000 },
    { nombre: "peso_pct", etiqueta: "Peso (% del proyecto)", tipo: "decimal", obligatorio: true, min: 0, max: 100, decimales: 4, ayuda: "La suma de los pesos de todas las tareas debe ser 100." },
    { nombre: "avance_pct", etiqueta: "Avance actual (%)", tipo: "decimal", obligatorio: true, porDefecto: "0", min: 0, max: 100, decimales: 2 },
    { nombre: "orden", etiqueta: "Orden en la lista", tipo: "entero", porDefecto: "0", min: 0, max: 100000 },
    { nombre: "wbs_id", etiqueta: "Elemento de la WBS", tipo: "seleccion", opcionesDe: "wbs" },
    { nombre: "capitulo_id", etiqueta: "Capítulo del presupuesto", tipo: "seleccion", opcionesDe: "capitulos" },
  ],
  seleccion: "id, nombre, semana_inicio, duracion_semanas, peso_pct, avance_pct",
  orden: [{ columna: "orden" }, { columna: "semana_inicio" }],
  columnas: [],
  ver: () => true,
  escribir: (p) => p.gestionar,
  borrar: true,
  despues: async (supabase, proyectoId) => refrescarMedicion(supabase, proyectoId),
  opciones: async (supabase: SupabaseClient, proyectoId: string) => {
    const [{ data: w }, { data: c }] = await Promise.all([
      supabase.from("wbs_elementos").select("id, codigo, nombre").eq("proyecto_id", proyectoId).order("codigo"),
      supabase.from("capitulos").select("id, codigo, nombre").eq("proyecto_id", proyectoId).order("orden"),
    ]);
    const op = (l: { id: string; codigo: string; nombre: string }[] | null) => (l ?? []).map((x) => ({ valor: x.id, etiqueta: `${x.codigo} ${x.nombre}` }));
    return { wbs: op(w), capitulos: op(c) };
  },
  validar: async (v, { supabase, proyectoId, registroId }) => {
    // La suma de los pesos no puede pasar de 100.
    let q = supabase.from("tareas").select("peso_pct").eq("proyecto_id", proyectoId);
    if (registroId) q = q.neq("id", registroId);
    const { data } = await q;
    const otros = ((data ?? []) as { peso_pct: number | string }[]).reduce((s, t) => s + Number(t.peso_pct), 0);
    const total = Math.round((otros + Number(v.peso_pct)) * 10000) / 10000;
    return total > 100 ? `La suma de los pesos no puede pasar de 100: las demás tareas suman ${Math.round(otros * 10000) / 10000} y esta agregaría ${v.peso_pct}.` : null;
  },
};
