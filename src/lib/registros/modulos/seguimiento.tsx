// Hitos y reuniones (hito 5): alimentan el reporte semanal y los KPIs de gestión.

import type { SupabaseClient } from "@supabase/supabase-js";
import { formatearFecha } from "@/lib/formato";
import { listaParametro } from "@/lib/pmo/parametros";
import type { Definicion } from "../tipos";

const hoyCO = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
const fecha = (v: unknown) => (typeof v === "string" ? formatearFecha(v) : "—");

export const HITOS: Definicion = {
  clave: "hitos",
  tabla: "hitos",
  titulo: "Hitos",
  singular: "hito",
  descripcion: "Cumplido = tiene fecha real. Vencido = sin fecha real y con fecha plan pasada",
  campos: [
    { nombre: "nombre", etiqueta: "Nombre del hito", tipo: "texto", obligatorio: true, max: 200 },
    { nombre: "fecha_plan", etiqueta: "Fecha planificada", tipo: "fecha", obligatorio: true },
    { nombre: "fecha_real", etiqueta: "Fecha real de cumplimiento", tipo: "fecha", ayuda: "Déjala vacía mientras no se cumpla." },
    { nombre: "cancelado", etiqueta: "Hito cancelado (no cuenta para los indicadores)", tipo: "casilla" },
  ],
  seleccion: "id, nombre, fecha_plan, fecha_real, cancelado",
  orden: [{ columna: "fecha_plan" }],
  columnas: [
    { etiqueta: "Hito", valor: (f) => String(f.nombre) },
    { etiqueta: "Plan", valor: (f) => fecha(f.fecha_plan) },
    { etiqueta: "Real", valor: (f) => fecha(f.fecha_real) },
    {
      etiqueta: "Estado",
      valor: (f) => (f.cancelado ? "Cancelado" : f.fecha_real ? ((f.fecha_real as string) <= (f.fecha_plan as string) ? "Cumplido a tiempo" : "Cumplido con retraso") : (f.fecha_plan as string) < hoyCO() ? "Vencido" : "Pendiente"),
    },
  ],
  ver: () => true,
  escribir: (p) => p.gestionar,
  borrar: true,
  validar: (v) => (v.cancelado && v.fecha_real ? "Un hito cancelado no puede tener fecha real de cumplimiento." : null),
};

export const REUNIONES: Definicion = {
  clave: "reuniones",
  tabla: "reuniones",
  titulo: "Reuniones",
  singular: "reunión",
  descripcion: "Alimentan el KPI de reuniones con acta",
  campos: [
    { nombre: "fecha", etiqueta: "Fecha", tipo: "fecha", obligatorio: true },
    { nombre: "tipo", etiqueta: "Tipo de reunión", tipo: "seleccion", obligatorio: true, opcionesDe: "tipos" },
    { nombre: "tiene_acta", etiqueta: "La reunión tiene acta documentada", tipo: "casilla" },
    { nombre: "acuerdos", etiqueta: "Acuerdos", tipo: "area" },
  ],
  seleccion: "id, fecha, tipo, tiene_acta, acuerdos",
  orden: [{ columna: "fecha", asc: false }],
  columnas: [
    { etiqueta: "Fecha", valor: (f) => fecha(f.fecha) },
    { etiqueta: "Tipo", valor: (f) => String(f.tipo) },
    { etiqueta: "Acta", valor: (f) => (f.tiene_acta ? "Sí" : "No") },
    { etiqueta: "Acuerdos", valor: (f) => (typeof f.acuerdos === "string" && f.acuerdos ? (f.acuerdos.length > 100 ? `${f.acuerdos.slice(0, 100)}…` : f.acuerdos) : "—") },
  ],
  ver: (p) => !p.interventor,
  escribir: (p) => p.gestionar,
  borrar: true,
  opciones: async (supabase: SupabaseClient, proyectoId: string) => {
    const [{ data: pars }, { data: proy }] = await Promise.all([
      supabase.from("parametros").select("ambito, ambito_id, clave, valor"),
      supabase.from("proyectos").select("portafolio_id").eq("id", proyectoId).maybeSingle(),
    ]);
    const tipos = listaParametro((pars ?? []) as never, "tipos_reunion", { proyectoId, portafolioId: proy?.portafolio_id ?? null });
    return { tipos: tipos.map((t) => ({ valor: t, etiqueta: t })) };
  },
};
