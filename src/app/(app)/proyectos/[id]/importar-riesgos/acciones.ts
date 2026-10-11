"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/sesion";
import { ES_UUID } from "@/lib/formato";
import { interpretarRiesgos, type ErrorFila, type RiesgoImportado } from "@/lib/riesgos/importar";
import { leerHojaRiesgos, MAX_BYTES_LIBRO } from "@/lib/riesgos/libro";

export type VistaRiesgos = {
  nombre: string;
  filasLeidas: number;
  riesgos: RiesgoImportado[];
  errores: ErrorFila[];
  avisos: string[];
  existentes: string[]; // códigos que ya existen en el proyecto (se actualizarán)
};
export type EstadoRiesgos = { error?: string; vista?: VistaRiesgos };

// Lee y valida el archivo en el servidor: lo que muestra la pantalla no es lo que se confía.
async function analizar(proyectoId: string, archivo: File): Promise<EstadoRiesgos & { supabase?: Awaited<ReturnType<typeof obtenerSesion>>["supabase"] }> {
  if (archivo.size === 0) return { error: "El archivo está vacío." };
  if (archivo.size > MAX_BYTES_LIBRO) return { error: "El archivo supera el tamaño máximo de 2 MB." };
  if (!/\.xlsx$/i.test(archivo.name)) return { error: "El archivo debe ser un libro de Excel .xlsx." };
  let filas;
  try {
    filas = await leerHojaRiesgos(await archivo.arrayBuffer());
  } catch (e) {
    const m = e instanceof Error && e.message.startsWith("No encontré") ? e.message : "No se pudo leer el archivo. Verifica que sea un .xlsx válido y no esté protegido con contraseña.";
    return { error: m };
  }
  const lectura = interpretarRiesgos(filas);
  const { supabase } = await obtenerSesion();
  const { data } = await supabase.from("riesgos").select("codigo").eq("proyecto_id", proyectoId);
  const actuales = new Set((data ?? []).map((r) => String(r.codigo)));
  return {
    supabase,
    vista: {
      nombre: archivo.name,
      filasLeidas: lectura.filasLeidas,
      riesgos: lectura.riesgos,
      errores: lectura.errores,
      avisos: lectura.avisos,
      existentes: lectura.riesgos.map((r) => r.codigo).filter((c) => actuales.has(c)),
    },
  };
}

export async function importarRiesgos(proyectoId: string, _prev: EstadoRiesgos, datos: FormData): Promise<EstadoRiesgos> {
  if (!ES_UUID.test(proyectoId)) return { error: "Dirección no válida." };
  const archivo = datos.get("archivo");
  if (!(archivo instanceof File)) return { error: "Elige un archivo de Excel (.xlsx)." };

  const r = await analizar(proyectoId, archivo);
  if (r.error || !r.vista || !r.supabase) return { error: r.error };
  if (datos.get("intencion") !== "confirmar") return { vista: r.vista };

  if (r.vista.errores.length > 0 || r.vista.riesgos.length === 0) return { vista: r.vista, error: "El archivo tiene errores. Corrígelo y vuelve a cargarlo." };
  const { error } = await r.supabase.rpc("riesgos_importar", { p_proyecto: proyectoId, p_filas: r.vista.riesgos });
  if (error) {
    if (error.code === "42501" || error.code === "22023") return { vista: r.vista, error: error.message };
    console.error("Fallo al importar riesgos:", { codigo: error.code, mensaje: error.message });
    return { vista: r.vista, error: "No se pudo completar la importación. Intenta de nuevo." };
  }
  revalidatePath(`/proyectos/${proyectoId}`, "layout");
  redirect(`/proyectos/${proyectoId}/r/riesgos?ok=riesgos_importados`);
}
