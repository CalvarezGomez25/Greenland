// Contexto común de las pantallas de un proyecto: sesión, proyecto y permisos de quien consulta.

import { notFound } from "next/navigation";
import { obtenerSesion } from "@/lib/sesion";
import { ES_UUID } from "@/lib/formato";
import { calcularPermisos } from "@/lib/permisos";
import { COLUMNAS_PROYECTO, type Proyecto, type RolProyecto } from "@/lib/tipos";

export async function cargarProyecto(id: string) {
  if (!ES_UUID.test(id)) notFound();
  const { supabase, perfil } = await obtenerSesion();
  // Si la persona no tiene acceso al proyecto, la base de datos no devuelve la fila: 404.
  const { data } = await supabase.from("proyectos").select(COLUMNAS_PROYECTO).eq("id", id).maybeSingle();
  if (!data) notFound();
  let rolProyecto: RolProyecto | null = null;
  if (perfil) {
    const { data: m } = await supabase
      .from("miembros_proyecto")
      .select("rol")
      .eq("proyecto_id", id)
      .eq("usuario_id", perfil.id)
      .maybeSingle();
    rolProyecto = (m?.rol as RolProyecto | undefined) ?? null;
  }
  const permisos = calcularPermisos(perfil?.rol_global ?? null, rolProyecto);
  return { supabase, perfil, proyecto: data as Proyecto, permisos };
}
