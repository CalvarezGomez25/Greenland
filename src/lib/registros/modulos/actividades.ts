// Actividades: trabajo asignado a personas del proyecto (migración 0024).
// La lista y el tablero están en /proyectos/[id]/actividades; aquí se declaran los campos del formulario.
import type { SupabaseClient } from "@supabase/supabase-js";
import { ESTADOS_ACTIVIDAD, ETIQUETA_ESTADO_ACTIVIDAD, ETIQUETA_PRIORIDAD } from "@/lib/actividades";
import { ETIQUETA_ROL_GLOBAL, ETIQUETA_ROL_PROYECTO, type RolGlobal, type RolProyecto } from "@/lib/tipos";
import type { Definicion, Opcion } from "../tipos";

type Persona = { nombre: string } | { nombre: string }[] | null;
const nombreDe = (p: Persona) => (Array.isArray(p) ? p[0]?.nombre : p?.nombre) ?? "Sin nombre";

export const ACTIVIDADES: Definicion = {
  clave: "actividades",
  tabla: "actividades",
  titulo: "Actividades",
  singular: "actividad",
  regreso: "actividades",
  campos: [
    { nombre: "titulo", etiqueta: "¿Qué hay que hacer?", tipo: "texto", obligatorio: true, max: 200 },
    { nombre: "descripcion", etiqueta: "Detalle", tipo: "area", max: 4000 },
    { nombre: "responsable_id", etiqueta: "Responsable", tipo: "seleccion", opcionesDe: "responsables", ayuda: "Una persona del equipo del proyecto. Si eres de interventoría, solo puedes asignártela a ti." },
    { nombre: "fecha_limite", etiqueta: "Fecha límite", tipo: "fecha" },
    { nombre: "prioridad", etiqueta: "Prioridad", tipo: "seleccion", obligatorio: true, porDefecto: "media", opciones: (["alta", "media", "baja"] as const).map((v) => ({ valor: v, etiqueta: ETIQUETA_PRIORIDAD[v] })) },
    { nombre: "estado", etiqueta: "Estado", tipo: "seleccion", obligatorio: true, porDefecto: "por_hacer", opciones: ESTADOS_ACTIVIDAD.map((v) => ({ valor: v, etiqueta: ETIQUETA_ESTADO_ACTIVIDAD[v] })) },
    { nombre: "riesgo_id", etiqueta: "Riesgo al que responde", tipo: "seleccion", opcionesDe: "riesgos", ayuda: "Opcional. Úsalo para las acciones del plan de respuesta de un riesgo." },
    { nombre: "wbs_id", etiqueta: "Elemento de la EDT", tipo: "seleccion", opcionesDe: "wbs", ayuda: "Opcional. Liga la actividad al entregable al que pertenece." },
  ],
  seleccion: "id, titulo, estado",
  orden: [{ columna: "creado_en", asc: false }],
  columnas: [],
  ver: () => true,
  // La base de datos decide: administrador, gerente, director general y analista PMO gestionan todo; la
  // interventoría solo lo suyo. El supervisor y los demás cambian el estado desde el tablero.
  escribir: (p) => p.gestionar || p.analista || p.director || p.interventor,
  borrar: true,
  opciones: async (supabase: SupabaseClient, proyectoId: string): Promise<Record<string, Opcion[]>> => {
    const [{ data: miembros }, { data: globales }, { data: riesgos }, { data: wbs }] = await Promise.all([
      supabase.from("miembros_proyecto").select("usuario_id, rol, perfiles(nombre)").eq("proyecto_id", proyectoId),
      supabase.from("perfiles").select("id, nombre, rol_global").in("rol_global", ["administrador", "director_general", "analista_pmo"]),
      supabase.from("riesgos").select("id, codigo, descripcion").eq("proyecto_id", proyectoId).order("codigo"),
      supabase.from("wbs_elementos").select("id, codigo, nombre").eq("proyecto_id", proyectoId).order("codigo"),
    ]);
    const personas = new Map<string, string>();
    for (const m of (miembros ?? []) as unknown as { usuario_id: string; rol: RolProyecto; perfiles: Persona }[])
      personas.set(m.usuario_id, `${nombreDe(m.perfiles)} (${ETIQUETA_ROL_PROYECTO[m.rol] ?? m.rol})`);
    for (const g of (globales ?? []) as { id: string; nombre: string; rol_global: RolGlobal }[])
      if (!personas.has(g.id)) personas.set(g.id, `${g.nombre} (${ETIQUETA_ROL_GLOBAL[g.rol_global]})`);
    const recorta = (t: string) => (t.length > 70 ? `${t.slice(0, 70)}…` : t);
    return {
      responsables: [...personas].map(([valor, etiqueta]) => ({ valor, etiqueta })).sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es")),
      riesgos: ((riesgos ?? []) as { id: string; codigo: string; descripcion: string }[]).map((r) => ({ valor: r.id, etiqueta: `${r.codigo} ${recorta(r.descripcion)}` })),
      wbs: ((wbs ?? []) as { id: string; codigo: string; nombre: string }[]).map((w) => ({ valor: w.id, etiqueta: `${w.codigo} ${w.nombre}` })),
    };
  },
};
