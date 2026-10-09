// Datos comunes de las pantallas de presupuesto: sesión, proyecto y permisos de quien consulta.
// Los permisos de aquí solo deciden qué se MUESTRA; la seguridad real la imponen las
// funciones y reglas de la base de datos.

import { notFound, redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/sesion";
import { ES_UUID } from "@/lib/formato";
import type { Perfil } from "@/lib/tipos";

export type Permisos = {
  editar: boolean; // Administrador o Gerente del proyecto
  verAuditoria: boolean; // Administrador, Director general o Gerente del proyecto
};

export async function cargarContexto(id: string, requiere?: "editar" | "auditoria") {
  if (!ES_UUID.test(id)) notFound();
  const { supabase, perfil } = await obtenerSesion();

  // Si la persona no tiene acceso al proyecto, la base de datos no devuelve la fila: 404.
  const { data } = await supabase.from("proyectos").select("id, nombre, duracion_meses").eq("id", id).maybeSingle();
  if (!data) notFound();

  const permisos = await calcularPermisos(supabase, perfil, id);
  if ((requiere === "editar" && !permisos.editar) || (requiere === "auditoria" && !permisos.verAuditoria)) {
    redirect(`/proyectos/${id}/presupuesto`);
  }
  return {
    supabase,
    perfil,
    permisos,
    proyecto: { id, nombre: data.nombre as string, duracion: data.duracion_meses as number },
  };
}

async function calcularPermisos(
  supabase: Awaited<ReturnType<typeof obtenerSesion>>["supabase"],
  perfil: Perfil | null,
  proyectoId: string,
): Promise<Permisos> {
  if (!perfil) return { editar: false, verAuditoria: false };
  const esAdmin = perfil.rol_global === "administrador";
  const veTodos = esAdmin || perfil.rol_global === "director_general";
  const { data } = await supabase
    .from("miembros_proyecto")
    .select("rol")
    .eq("proyecto_id", proyectoId)
    .eq("usuario_id", perfil.id)
    .maybeSingle();
  const esGerente = data?.rol === "gerente";
  return { editar: esAdmin || esGerente, verAuditoria: veTodos || esGerente };
}
