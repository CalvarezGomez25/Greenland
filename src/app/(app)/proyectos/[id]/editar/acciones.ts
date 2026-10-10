"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { obtenerSesion } from "@/lib/sesion";
import { ES_UUID } from "@/lib/formato";
import { validarFicha, validarProyecto } from "@/lib/proyecto-validar";
import type { EstadoProyecto } from "../../nuevo/acciones";

export async function editarProyecto(
  proyectoId: string,
  _anterior: EstadoProyecto,
  datos: FormData,
): Promise<EstadoProyecto> {
  if (!ES_UUID.test(proyectoId)) return { error: "Proyecto no válido." };
  const { supabase, perfil } = await obtenerSesion();
  if (!perfil) redirect("/ingreso");

  const v = validarProyecto(datos);
  if ("error" in v) return { error: v.error };

  const f = validarFicha(datos);
  if ("error" in f) return { error: f.error };
  const esAdmin = perfil.rol_global === "administrador";
  // El gerente no cambia código, organización ni portafolio: se conservan los actuales.
  let { codigo, organizacion_id, portafolio_id } = f.ficha;
  if (!esAdmin) {
    const { data: actual } = await supabase.from("proyectos").select("codigo, organizacion_id, portafolio_id").eq("id", proyectoId).maybeSingle();
    if (!actual) return { error: "No se encontró el proyecto o no tienes permiso." };
    ({ codigo, organizacion_id, portafolio_id } = actual);
  }

  // Administrador o Gerente del proyecto: lo decide y lo verifica la base de datos.
  const { error } = await supabase.rpc("proyecto_editar", {
    p_proyecto: proyectoId,
    p_nombre: v.datos.nombre,
    p_cliente: v.datos.cliente,
    p_ubicacion: v.datos.ubicacion,
    p_fecha_inicio: v.datos.fecha_inicio,
    p_duracion: v.datos.duracion_meses,
  });

  if (error) {
    if (error.code === "42501") return { error: "No tienes permiso para editar este proyecto." };
    if (error.code === "22023") return { error: error.message };
    console.error("Fallo al editar proyecto:", error.code, error.message);
    return {
      error: `No se pudo guardar el proyecto${error.code ? ` (código ${error.code})` : ""}. Intenta de nuevo o avisa al administrador.`,
    };
  }

  const { error: errFicha } = await supabase.rpc("proyecto_ficha_guardar", {
    p_proyecto: proyectoId,
    p_tipo: f.ficha.tipo,
    p_fase: f.ficha.fase,
    p_estado: f.ficha.estado,
    p_usa_obra: f.ficha.usa_obra,
    p_organizacion: organizacion_id,
    p_portafolio: portafolio_id,
    p_codigo: codigo,
  });
  if (errFicha) {
    if (errFicha.code === "42501" || errFicha.code === "22023") return { error: errFicha.message };
    console.error("Fallo al guardar la ficha:", errFicha.code, errFicha.message);
    return { error: `No se pudo guardar la ficha${errFicha.code ? ` (código ${errFicha.code})` : ""}.` };
  }

  revalidatePath("/");
  revalidatePath(`/proyectos/${proyectoId}`);
  redirect(`/proyectos/${proyectoId}`);
}
