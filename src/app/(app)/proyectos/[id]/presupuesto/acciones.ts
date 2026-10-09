"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/sesion";
import { ES_UUID } from "@/lib/formato";
import { leerCsvPresupuesto, leerNumeroColombiano } from "@/lib/presupuesto/csv";
import type { Estado } from "@/lib/presupuesto/estado";

// Todas las acciones llaman a las funciones de la base de datos, que vuelven a verificar
// permisos y datos y dejan constancia en el registro de cambios.

const DIRECCION_INVALIDA = "Dirección no válida.";

function conError(error: string, datos: FormData): Estado {
  const valores: Record<string, string> = {};
  for (const [clave, valor] of datos.entries()) {
    if (typeof valor === "string" && !clave.startsWith("$") && clave !== "texto") valores[clave] = valor;
  }
  return { error, valores };
}

// Traduce el error de la base de datos. Los códigos 42501 y 22023 traen mensajes ya
// redactados para el usuario; el resto se registra en el servidor y se muestra genérico.
function mensajeDeRpc(error: { code?: string; message: string }): string {
  if (error.code === "42501" || error.code === "22023") return error.message;
  if (error.code === "23505") return "Ya existe un registro con ese código o nombre.";
  if (error.code === "28000") return "Debes iniciar sesión de nuevo.";
  console.error("Fallo en una operación del presupuesto:", { codigo: error.code, mensaje: error.message });
  return "No se pudo completar la operación. Intenta de nuevo.";
}

function terminar(proyectoId: string, subruta: string, ok: string): never {
  revalidatePath(`/proyectos/${proyectoId}/presupuesto`, "layout");
  redirect(`/proyectos/${proyectoId}/presupuesto${subruta}?ok=${ok}`);
}

const campo = (datos: FormData, nombre: string) => String(datos.get(nombre) ?? "").trim();

function motivoObligatorio(datos: FormData): string | null {
  const motivo = campo(datos, "motivo");
  return motivo.length >= 3 ? motivo : null;
}

function numero(datos: FormData, nombre: string, etiqueta: string, decimales: number, enteros: number) {
  const r = leerNumeroColombiano(campo(datos, nombre), decimales, enteros);
  return r.ok ? { valor: r.valor } : { error: `${etiqueta} ${r.motivo}.` };
}

// ---- Importación ------------------------------------------------------------

export async function importarCsv(proyectoId: string, _prev: Estado, datos: FormData): Promise<Estado> {
  if (!ES_UUID.test(proyectoId)) return { error: DIRECCION_INVALIDA };
  const motivo = motivoObligatorio(datos);
  if (!motivo) return conError("Escribe el motivo de la importación (mínimo 3 caracteres).", datos);

  // Se vuelve a leer el archivo aquí: lo que ve la persona en pantalla no es lo que se confía.
  const lectura = leerCsvPresupuesto(String(datos.get("texto") ?? ""));
  if (lectura.errores.length > 0 || lectura.filas.length === 0) {
    return conError("El archivo tiene errores. Corrígelo y vuelve a cargarlo.", datos);
  }

  const { supabase } = await obtenerSesion();
  const { error } = await supabase.rpc("presupuesto_importar", {
    p_proyecto: proyectoId,
    p_filas: lectura.filas.map(({ capitulo, codigo, descripcion, unidad, cantidad, precio_unitario }) => ({
      capitulo,
      codigo,
      descripcion,
      unidad,
      cantidad,
      precio_unitario,
    })),
    p_motivo: motivo,
  });
  if (error) return conError(mensajeDeRpc(error), datos);
  terminar(proyectoId, "", "importacion");
}

// ---- Partidas ---------------------------------------------------------------

export async function guardarPartida(
  proyectoId: string,
  partidaId: string | null,
  _prev: Estado,
  datos: FormData,
): Promise<Estado> {
  if (!ES_UUID.test(proyectoId) || (partidaId !== null && !ES_UUID.test(partidaId))) return { error: DIRECCION_INVALIDA };

  const cantidad = numero(datos, "cantidad", "La cantidad", 4, 14);
  if (cantidad.error) return conError(cantidad.error, datos);
  const precio = numero(datos, "precio", "El precio unitario", 2, 16);
  if (precio.error) return conError(precio.error, datos);

  const { supabase } = await obtenerSesion();
  const { error } = await supabase.rpc("partida_guardar", {
    p_proyecto: proyectoId,
    p_id: partidaId,
    p_capitulo: campo(datos, "capitulo"),
    p_codigo: campo(datos, "codigo"),
    p_descripcion: campo(datos, "descripcion"),
    p_unidad: campo(datos, "unidad"),
    p_cantidad: cantidad.valor,
    p_precio: precio.valor,
    p_motivo: campo(datos, "motivo") || null,
  });
  if (error) return conError(mensajeDeRpc(error), datos);
  terminar(proyectoId, "", "partida");
}

export async function borrarPartida(proyectoId: string, partidaId: string, _prev: Estado, datos: FormData): Promise<Estado> {
  if (!ES_UUID.test(proyectoId) || !ES_UUID.test(partidaId)) return { error: DIRECCION_INVALIDA };
  const motivo = motivoObligatorio(datos);
  if (!motivo) return conError("Escribe el motivo (mínimo 3 caracteres).", datos);

  const { supabase } = await obtenerSesion();
  const { error } = await supabase.rpc("partida_borrar", { p_partida: partidaId, p_motivo: motivo });
  if (error) return conError(mensajeDeRpc(error), datos);
  terminar(proyectoId, "", "partida_borrada");
}

// ---- Costos adicionales -----------------------------------------------------

export async function guardarCostoAdicional(
  proyectoId: string,
  lineaId: string | null,
  _prev: Estado,
  datos: FormData,
): Promise<Estado> {
  if (!ES_UUID.test(proyectoId) || (lineaId !== null && !ES_UUID.test(lineaId))) return { error: DIRECCION_INVALIDA };

  const porcentaje = numero(datos, "porcentaje", "El porcentaje", 4, 3);
  if (porcentaje.error) return conError(porcentaje.error, datos);
  if (Number(porcentaje.valor) > 100) return conError("El porcentaje no puede superar 100.", datos);

  const base = campo(datos, "base");
  if (base !== "costo_directo" && !ES_UUID.test(base)) return conError("Elige sobre qué se calcula.", datos);

  const { supabase } = await obtenerSesion();
  const { error } = await supabase.rpc("costo_adicional_guardar", {
    p_proyecto: proyectoId,
    p_id: lineaId,
    p_nombre: campo(datos, "nombre"),
    p_base: base === "costo_directo" ? "costo_directo" : "linea",
    p_linea_base: base === "costo_directo" ? null : base,
    p_porcentaje: porcentaje.valor,
    p_motivo: campo(datos, "motivo") || null,
  });
  if (error) return conError(mensajeDeRpc(error), datos);
  terminar(proyectoId, "/costos", "costos");
}

export async function borrarCostoAdicional(proyectoId: string, lineaId: string, _prev: Estado, datos: FormData): Promise<Estado> {
  if (!ES_UUID.test(proyectoId) || !ES_UUID.test(lineaId)) return { error: DIRECCION_INVALIDA };
  const motivo = motivoObligatorio(datos);
  if (!motivo) return conError("Escribe el motivo (mínimo 3 caracteres).", datos);

  const { supabase } = await obtenerSesion();
  const { error } = await supabase.rpc("costo_adicional_borrar", { p_linea: lineaId, p_motivo: motivo });
  if (error) return conError(mensajeDeRpc(error), datos);
  terminar(proyectoId, "/costos", "costos");
}

export async function crearPlantillaCostos(proyectoId: string): Promise<Estado> {
  if (!ES_UUID.test(proyectoId)) return { error: DIRECCION_INVALIDA };
  const { supabase } = await obtenerSesion();
  const { error } = await supabase.rpc("costos_adicionales_plantilla", { p_proyecto: proyectoId });
  if (error) return { error: mensajeDeRpc(error) };
  terminar(proyectoId, "/costos", "plantilla");
}

// ---- Gasto real mensual -----------------------------------------------------

export async function registrarGasto(proyectoId: string, _prev: Estado, datos: FormData): Promise<Estado> {
  if (!ES_UUID.test(proyectoId)) return { error: DIRECCION_INVALIDA };
  const mes = Number(campo(datos, "mes"));
  if (!Number.isInteger(mes) || mes < 1) return conError("Elige el mes.", datos);
  const valor = numero(datos, "valor", "El gasto", 2, 16);
  if (valor.error) return conError(valor.error, datos);

  const { supabase } = await obtenerSesion();
  const { error } = await supabase.rpc("gasto_registrar", {
    p_proyecto: proyectoId,
    p_mes: mes,
    p_valor: valor.valor,
    p_motivo: campo(datos, "motivo") || null,
  });
  if (error) return conError(mensajeDeRpc(error), datos);
  terminar(proyectoId, "/gasto", "gasto");
}

export async function borrarGastoMes(proyectoId: string, _prev: Estado, datos: FormData): Promise<Estado> {
  if (!ES_UUID.test(proyectoId)) return { error: DIRECCION_INVALIDA };
  const mes = Number(campo(datos, "mes"));
  if (!Number.isInteger(mes) || mes < 1) return { error: "Mes no válido." };
  const motivo = motivoObligatorio(datos);
  if (!motivo) return conError("Escribe el motivo (mínimo 3 caracteres).", datos);

  const { supabase } = await obtenerSesion();
  const { error } = await supabase.rpc("gasto_borrar_mes", { p_proyecto: proyectoId, p_mes: mes, p_motivo: motivo });
  if (error) return conError(mensajeDeRpc(error), datos);
  terminar(proyectoId, "/gasto", "gasto");
}
