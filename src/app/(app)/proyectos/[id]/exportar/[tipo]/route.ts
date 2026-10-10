import type { NextRequest } from "next/server";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { ES_UUID } from "@/lib/formato";
import { hoyColombia } from "@/lib/pmo/cargar";
import { indicadoresBorrador } from "@/lib/pmo/reporte";
import { documentoCambios, documentoContratos, documentoEvm, documentoReporte } from "@/lib/exportar/proyecto";
import { formatoDe, respuestaDescarga } from "@/lib/exportar/respuesta";

const noEncontrado = () => new Response("No encontrado", { status: 404 });

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string; tipo: string }> }) {
  const { id, tipo } = await ctx.params;
  const { supabase, proyecto, permisos } = await cargarProyecto(id);
  const hoy = hoyColombia();
  const formato = formatoDe(req.nextUrl.searchParams.get("formato"));
  if (permisos.interventor && tipo !== "contratos") return new Response("Tu rol no incluye esta exportación", { status: 403 });

  if (tipo === "reporte") {
    const rid = req.nextUrl.searchParams.get("reporte") ?? "";
    if (!ES_UUID.test(rid)) return noEncontrado();
    const { data: r } = await supabase.from("reportes_semanales").select("*").eq("id", rid).eq("proyecto_id", id).maybeSingle();
    if (!r) return noEncontrado();
    const foto = r.enviado_en ? (r.foto ?? {}) : await indicadoresBorrador(supabase, id, r.fecha_reporte);
    const doc = documentoReporte({ proyecto: proyecto.nombre, semana: r.semana, anio: r.anio, fecha: r.fecha_reporte, enviado: r.enviado_en, estado: r.estado_reportado, foto, logros: r.logros, alertas: r.alertas, decisiones: r.decisiones_requeridas, proximos: r.proximos_hitos, proxima: r.proxima_revision }, hoy);
    return respuestaDescarga(doc, formato, `reporte-${proyecto.codigo ?? "proyecto"}-semana-${r.anio}-${r.semana}`);
  }
  if (tipo === "evm") {
    const { data } = await supabase.from("mediciones_evm").select("fecha_corte, origen, bac, pv, ev, ac").eq("proyecto_id", id).order("fecha_corte", { ascending: false }).limit(500);
    return respuestaDescarga(documentoEvm(proyecto.nombre, data ?? [], hoy), formato, `valor-ganado-${proyecto.codigo ?? "proyecto"}-${hoy}`);
  }
  if (tipo === "cambios") {
    const { data } = await supabase.from("cambios").select("codigo, fecha_solicitud, tipo, descripcion_despues, impacto_costo, impacto_dias, nivel, variacion_pct, estado_flujo, detectado_sin_formato").eq("proyecto_id", id).order("codigo").limit(1000);
    return respuestaDescarga(documentoCambios(proyecto.nombre, data ?? [], hoy), formato, `cambios-${proyecto.codigo ?? "proyecto"}-${hoy}`);
  }
  if (tipo === "contratos") {
    const [{ data: cs }, { data: as }] = await Promise.all([
      supabase.from("contratos").select("id, tipo, contratista, objeto, valor, anticipo_pct, anticipo_valor, retencion_pct, retencion_liberada").eq("proyecto_id", id).order("creado_en"),
      supabase.from("actas_pago").select("contrato_id, numero, fecha, valor_bruto, amortizacion, retencion, neto, estado").eq("proyecto_id", id).order("fecha"),
    ]);
    return respuestaDescarga(documentoContratos(proyecto.nombre, cs ?? [], as ?? [], hoy), formato, `contratos-${proyecto.codigo ?? "proyecto"}-${hoy}`);
  }
  return noEncontrado();
}
