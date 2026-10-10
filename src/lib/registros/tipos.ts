// Marco genérico para módulos de "lista de registros por proyecto" (stakeholders, riesgos,
// hitos, tareas...). Cada módulo se declara con una Definicion y comparte pantallas y acciones.

import type { ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Permisos } from "@/lib/permisos";
import type { FilaParametro } from "@/lib/pmo/parametros";

export type Opcion = { valor: string; etiqueta: string };

export type CampoDef = {
  nombre: string;
  etiqueta: string;
  tipo: "texto" | "area" | "entero" | "decimal" | "fecha" | "seleccion" | "casilla";
  obligatorio?: boolean;
  max?: number; // texto: largo máximo; entero/decimal: valor máximo
  min?: number; // entero/decimal: valor mínimo
  decimales?: number; // decimal: máximo de decimales (por defecto 2)
  opciones?: Opcion[]; // seleccion con opciones fijas
  opcionesDe?: string; // seleccion con opciones cargadas de la base (clave en Definicion.opciones)
  ayuda?: string;
  porDefecto?: string;
  soloAlCrear?: boolean; // no se puede cambiar al editar
};

export type Fila = Record<string, unknown>;
export type Valores = Record<string, string | number | boolean | null>;
export type ContextoLista = {
  opciones: Record<string, Opcion[]>;
  parametros: FilaParametro[];
  proyecto: { id: string; portafolio_id: string | null };
  permisos: Permisos;
};

export type Definicion = {
  clave: string;
  tabla: string;
  titulo: string;
  singular: string;
  descripcion?: string;
  campos: CampoDef[];
  seleccion: string; // columnas a leer para la lista
  orden: { columna: string; asc?: boolean }[];
  columnas: { etiqueta: string; valor: (fila: Fila, ctx: ContextoLista) => ReactNode }[];
  ordenar?: (filas: Fila[]) => Fila[]; // orden propio (por ejemplo, códigos 1.2 antes que 1.10)
  extra?: (filas: Fila[], ctx: ContextoLista) => ReactNode; // bloque encima de la tabla (matrices, botones)
  ver: (p: Permisos) => boolean;
  escribir: (p: Permisos) => boolean;
  borrar?: boolean;
  opciones?: (supabase: SupabaseClient, proyectoId: string) => Promise<Record<string, Opcion[]>>;
  validar?: (valores: Valores, ctx: { supabase: SupabaseClient; proyectoId: string; registroId: string | null }) => Promise<string | null> | string | null;
};
