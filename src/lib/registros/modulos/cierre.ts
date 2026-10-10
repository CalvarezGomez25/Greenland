// Lecciones aprendidas (hito 9).
import type { SupabaseClient } from "@supabase/supabase-js";
import { listaParametro } from "@/lib/pmo/parametros";
import type { Definicion } from "../tipos";

export const LECCIONES: Definicion = {
  clave: "lecciones",
  tabla: "lecciones_aprendidas",
  titulo: "Lecciones aprendidas",
  singular: "lección",
  regreso: "cierre",
  descripcion: "Las lecciones de los cambios se consolidan en el cierre",
  campos: [
    { nombre: "categoria", etiqueta: "Categoría", tipo: "seleccion", obligatorio: true, opcionesDe: "categorias" },
    { nombre: "descripcion", etiqueta: "Qué pasó / qué se aprendió", tipo: "area", obligatorio: true },
    { nombre: "recomendacion", etiqueta: "Recomendación", tipo: "area" },
    { nombre: "cambio_id", etiqueta: "Cambio relacionado", tipo: "seleccion", opcionesDe: "cambios" },
  ],
  seleccion: "id, categoria, descripcion, recomendacion",
  orden: [{ columna: "creado_en", asc: false }],
  columnas: [
    { etiqueta: "Categoría", valor: (f) => String(f.categoria) },
    { etiqueta: "Lección", valor: (f) => String(f.descripcion) },
    { etiqueta: "Recomendación", valor: (f) => String(f.recomendacion ?? "—") },
  ],
  ver: (p) => !p.interventor,
  escribir: (p) => p.gestionar,
  borrar: true,
  opciones: async (supabase: SupabaseClient, proyectoId: string) => {
    const [{ data: pars }, { data: proy }, { data: camb }] = await Promise.all([
      supabase.from("parametros").select("ambito, ambito_id, clave, valor"),
      supabase.from("proyectos").select("portafolio_id").eq("id", proyectoId).maybeSingle(),
      supabase.from("cambios").select("id, codigo, tipo").eq("proyecto_id", proyectoId).order("codigo"),
    ]);
    const cats = listaParametro((pars ?? []) as never, "categorias_leccion", { proyectoId, portafolioId: proy?.portafolio_id ?? null });
    return {
      categorias: cats.map((c) => ({ valor: c, etiqueta: c })),
      cambios: ((camb ?? []) as { id: string; codigo: string; tipo: string }[]).map((c) => ({ valor: c.id, etiqueta: `${c.codigo} · ${c.tipo}` })),
    };
  },
};
