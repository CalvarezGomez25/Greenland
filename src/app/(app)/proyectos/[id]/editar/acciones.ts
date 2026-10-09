"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { exigirAdministrador } from "@/lib/sesion";
import { ES_UUID } from "@/lib/formato";
import { validarProyecto } from "@/lib/proyecto-validar";
import type { EstadoProyecto } from "../../nuevo/acciones";

export async function editarProyecto(
  proyectoId: string,
  _anterior: EstadoProyecto,
  datos: FormData,
): Promise<EstadoProyecto> {
  // Solo el administrador; la base de datos lo vuelve a verificar.
  const { supabase } = await exigirAdministrador();
  if (!ES_UUID.test(proyectoId)) return { error: "Proyecto no válido." };

  const v = validarProyecto(datos);
  if ("error" in v) return { error: v.error };

  // No se puede acortar la obra por debajo de un mes que ya tiene gasto registrado.
  const { data: ultimo, error: errGasto } = await supabase
    .from("gasto_mensual")
    .select("mes")
    .eq("proyecto_id", proyectoId)
    .order("mes", { ascending: false })
    .limit(1);
  if (errGasto) return { error: "No se pudo verificar el gasto registrado. Intenta de nuevo." };
  const mesMax = ultimo?.[0]?.mes ?? 0;
  if (v.datos.duracion_meses < mesMax) {
    return {
      error: `Ya hay gasto registrado hasta el mes ${mesMax}. La duración no puede ser menor; borra primero ese gasto si es un error.`,
    };
  }

  const { data, error } = await supabase
    .from("proyectos")
    .update(v.datos)
    .eq("id", proyectoId)
    .select("id");

  if (error) {
    console.error("Fallo al editar proyecto:", error.code, error.message);
    return {
      error:
        error.code === "42501"
          ? "No tienes permiso para editar proyectos."
          : "No se pudo guardar el proyecto. Intenta de nuevo.",
    };
  }
  if (!data || data.length === 0) return { error: "No se encontró el proyecto o no tienes permiso." };

  revalidatePath("/");
  revalidatePath(`/proyectos/${proyectoId}`);
  redirect(`/proyectos/${proyectoId}`);
}
