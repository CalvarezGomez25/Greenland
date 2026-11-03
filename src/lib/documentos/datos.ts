// Lectura de los datos de un contrato (y de una modificación) para generar un documento. Se hace con la sesión de quien consulta.

import type { SupabaseClient } from "@supabase/supabase-js";
import { desdeJson } from "../presupuesto/dinero";
import type { FilaParametro } from "../pmo/parametros";
import type { DatosDocumento } from "./campos";

export async function cargarDatosDocumento(supabase: SupabaseClient, proyectoId: string, contratoId: string, modificacionId: string | null): Promise<DatosDocumento | null> {
  const [{ data: c }, { data: proy }] = await Promise.all([
    supabase.from("contratos").select("id, tipo, objeto, valor, contratista, tercero_id, consecutivo, orden_servicio_sap, fecha_firma, fecha_acta_inicio, fecha_fin_vigente, plazo_valor, plazo_unidad").eq("id", contratoId).eq("proyecto_id", proyectoId).maybeSingle(),
    supabase.from("proyectos").select("nombre, ubicacion, contratante_id").eq("id", proyectoId).maybeSingle(),
  ]);
  if (!c || !proy) return null;
  const [{ data: t }, { data: ct }, { data: as }, { data: ms }, { data: pars }] = await Promise.all([
    c.tercero_id ? supabase.from("terceros").select("razon_social, nit, municipio, direccion, correo_notificacion, representante_legal").eq("id", c.tercero_id).maybeSingle() : Promise.resolve({ data: null }),
    proy.contratante_id ? supabase.from("contratantes").select("razon_social, nit, municipio, correo_notificacion, correo_facturacion, representante_legal").eq("id", proy.contratante_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("actas_pago").select("valor_bruto, amortizacion, retencion").eq("contrato_id", contratoId),
    supabase.from("contrato_modificaciones").select("id, tipo, numero, fecha_firma, nueva_fecha_fin, valor, descripcion, justificacion, estado").eq("contrato_id", contratoId).order("creado_en"),
    supabase.from("parametros").select("ambito, ambito_id, clave, valor"),
  ]);
  const c2 = (x: number | string) => desdeJson(x, 2);
  const d = (x: string | null) => (x ? String(x).slice(0, 10) : null);
  return {
    hoy: new Date().toISOString().slice(0, 10), proyectoId,
    proyecto: { nombre: proy.nombre as string, ubicacion: (proy.ubicacion as string | null) ?? null },
    contrato: { tipo: c.tipo, objeto: c.objeto, valor: c2(c.valor), consecutivo: c.consecutivo, fechaFirma: d(c.fecha_firma), fechaActaInicio: d(c.fecha_acta_inicio), fechaFinVigente: d(c.fecha_fin_vigente), plazoValor: c.plazo_valor, plazoUnidad: c.plazo_unidad, contratista: c.contratista, ordenServicio: c.orden_servicio_sap },
    tercero: t ? { razonSocial: t.razon_social, nit: t.nit, municipio: t.municipio, direccion: t.direccion, correo: t.correo_notificacion, representante: t.representante_legal } : null,
    contratante: ct ? { razonSocial: ct.razon_social, nit: ct.nit, municipio: ct.municipio, correo: ct.correo_notificacion, correoFacturacion: ct.correo_facturacion, representante: ct.representante_legal } : null,
    actas: ((as ?? []) as { valor_bruto: number | string; amortizacion: number | string; retencion: number | string }[]).map((a) => ({ bruto: c2(a.valor_bruto), amortizacion: c2(a.amortizacion), retencion: c2(a.retencion) })),
    modificaciones: ((ms ?? []) as { id: string; tipo: string; numero: number; fecha_firma: string | null; nueva_fecha_fin: string | null; valor: number | string; descripcion: string; justificacion: string | null; estado: string }[])
      .map((m) => ({ id: m.id, tipo: m.tipo, numero: m.numero, fechaFirma: d(m.fecha_firma), nuevaFechaFin: d(m.nueva_fecha_fin), valor: c2(m.valor), descripcion: m.descripcion, justificacion: m.justificacion, estado: m.estado })),
    modificacionId, parametros: (pars ?? []) as FilaParametro[],
  };
}

export const nombreArchivoSeguro = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80) || "documento";
