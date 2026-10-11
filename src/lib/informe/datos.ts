// Lectura de los datos del informe gerencial con la sesión de quien consulta (las reglas de la base deciden qué ve).
import type { SupabaseClient } from "@supabase/supabase-js";
import { cargarDatosPortafolio, hoyColombia } from "../pmo/cargar";
import { armarPortafolio, requiereDecision } from "../pmo/portafolio";
import { nivelDeRiesgo, type Color, type NivelRiesgo } from "../pmo/semaforo";
import { numeroParametro } from "../pmo/parametros";
import { CORTES_RIESGO } from "../pmo/planificacion";
import { ETIQUETA_ESTADO_CAMBIO, type EstadoCambio } from "../pmo/cambios";
import { desdeJson } from "../presupuesto/dinero";
import { leerTodo } from "../presupuesto/paginar";
import { ordenarPorCodigo } from "../navegacion";
import type { InformeProyecto } from "./modelo";

const pesos = (c: bigint) => Number(c) / 100;
const ORDEN_NIVEL: Record<NivelRiesgo, number> = { critico: 3, alto: 2, medio: 1, bajo: 0 };

type Fila = Record<string, unknown>;
const leer = async (armar: (d: number, h: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>): Promise<Fila[]> => {
  try { return await leerTodo<Fila>((d, h) => armar(d, h) as never); } catch { return []; }
};

// Un informe por proyecto. `proyectoId`: solo ese proyecto (de cualquier estado). Sin él: los proyectos activos.
export async function cargarInformes(supabase: SupabaseClient, opciones: { proyectoId?: string } = {}): Promise<InformeProyecto[] | null> {
  const datos = await cargarDatosPortafolio(supabase);
  if (datos.error) return null;
  const hoy = hoyColombia();
  const elegidos = datos.proyectos.filter((p) => (opciones.proyectoId ? p.id === opciones.proyectoId : p.estado === "activo"));
  if (elegidos.length === 0) return [];
  const ids = elegidos.map((p) => p.id);
  const unico = ids.length === 1 ? ids[0] : null;

  const [detalle, perfiles, riesgos, cambios, proximos, reportes] = await Promise.all([
    supabase.from("proyectos").select("id, cliente, ubicacion, fase, estado, fecha_inicio, duracion_meses").in("id", ids),
    supabase.from("perfiles").select("id, nombre"),
    leer((d, h) => (unico ? supabase.from("riesgos").select("proyecto_id, codigo, frente, descripcion, score, responsable").eq("proyecto_id", unico) : supabase.from("riesgos").select("proyecto_id, codigo, frente, descripcion, score, responsable")).eq("estado", "activo").order("score", { ascending: false }).order("codigo").range(d, h)),
    leer((d, h) => (unico ? supabase.from("cambios").select("proyecto_id, codigo, descripcion_despues, estado_flujo, impacto_costo, nivel").eq("proyecto_id", unico) : supabase.from("cambios").select("proyecto_id, codigo, descripcion_despues, estado_flujo, impacto_costo, nivel")).not("estado_flujo", "in", "(cerrado,rechazado)").order("codigo").range(d, h)),
    leer((d, h) => (unico ? supabase.from("hitos").select("proyecto_id, nombre, fecha_plan").eq("proyecto_id", unico) : supabase.from("hitos").select("proyecto_id, nombre, fecha_plan")).is("fecha_real", null).eq("cancelado", false).gte("fecha_plan", hoy).order("fecha_plan").order("nombre").range(d, h)),
    leer((d, h) => (unico ? supabase.from("reportes_semanales").select("id, proyecto_id, anio, semana, estado_reportado, logros, alertas, decisiones_requeridas").eq("proyecto_id", unico) : supabase.from("reportes_semanales").select("id, proyecto_id, anio, semana, estado_reportado, logros, alertas, decisiones_requeridas")).not("enviado_en", "is", null).order("anio", { ascending: false }).order("semana", { ascending: false }).order("id").range(d, h)),
  ]);

  const det = new Map(((detalle.data ?? []) as Fila[]).map((x) => [String(x.id), x]));
  const nombrePerfil = new Map(((perfiles.data ?? []) as { id: string; nombre: string }[]).map((p) => [p.id, p.nombre]));
  const { filas } = armarPortafolio({ ...datos.entrada, proyectos: elegidos });
  const decisiones = requiereDecision(filas, datos.parametros);
  const porProyecto = <T extends Fila>(lista: T[], id: string) => lista.filter((x) => x.proyecto_id === id);

  const informes: InformeProyecto[] = filas.map((f) => {
    const p = f.proyecto;
    const d = det.get(p.id) ?? {};
    const ctx = { proyectoId: p.id, portafolioId: p.portafolio_id };
    const cortes = {
      critico: numeroParametro(datos.parametros, "riesgo_critico_min", ctx, CORTES_RIESGO.critico),
      alto: numeroParametro(datos.parametros, "riesgo_alto_min", ctx, CORTES_RIESGO.alto),
      medio: numeroParametro(datos.parametros, "riesgo_medio_min", ctx, CORTES_RIESGO.medio),
    };
    const rs = porProyecto(riesgos, p.id).map((r) => ({
      codigo: String(r.codigo), frente: (r.frente as string | null) ?? null, descripcion: String(r.descripcion), score: Number(r.score),
      nivel: nivelDeRiesgo(Number(r.score), cortes), responsable: (r.responsable as string | null) ?? null,
    }));
    rs.sort((a, b) => ORDEN_NIVEL[b.nivel] - ORDEN_NIVEL[a.nivel] || b.score - a.score || a.codigo.localeCompare(b.codigo, "es", { numeric: true }));
    const cuenta = (n: NivelRiesgo) => rs.filter((r) => r.nivel === n).length;
    const cs = porProyecto(cambios, p.id).map((c) => ({
      codigo: String(c.codigo), descripcion: String(c.descripcion_despues ?? ""), estado: ETIQUETA_ESTADO_CAMBIO[c.estado_flujo as EstadoCambio] ?? String(c.estado_flujo),
      impactoCosto: pesos(desdeJson(c.impacto_costo as number | string, 2)), nivel: (c.nivel as string | null) ?? null,
    }));
    const rep = porProyecto(reportes, p.id)[0];
    const m = f.medicion;
    const gerenteId = datos.gerentes.get(p.id);
    return {
      generado: hoy,
      proyecto: {
        id: p.id, nombre: p.nombre, codigo: p.codigo, cliente: (d.cliente as string | null) ?? null, ubicacion: (d.ubicacion as string | null) ?? null,
        fase: String(d.fase ?? p.fase), estado: String(d.estado ?? p.estado), inicio: (d.fecha_inicio as string | null) ?? null,
        duracionMeses: d.duracion_meses === undefined || d.duracion_meses === null ? null : Number(d.duracion_meses),
        gerente: gerenteId ? nombrePerfil.get(gerenteId) ?? null : null,
      },
      semaforo: f.semaforo,
      corteEvm: m?.fecha_corte ?? null,
      spi: f.evm?.spi ?? null, cpi: f.evm?.cpi ?? null,
      avanceFisico: f.evm?.avanceFisico ?? null, avancePlan: f.evm?.avancePlan ?? null, avanceFinanciero: f.evm?.avanceFinanciero ?? null,
      bac: m ? pesos(m.bac) : null, pv: m ? pesos(m.pv) : null, ev: m ? pesos(m.ev) : null, ac: m ? pesos(m.ac) : null,
      eac: f.evm?.eac != null ? pesos(f.evm.eac) : null,
      riesgos: { activos: rs.length, criticos: cuenta("critico"), altos: cuenta("alto"), medios: cuenta("medio"), bajos: cuenta("bajo"), principales: rs.slice(0, 5) },
      cambios: { pendientes: cs.length, criticos: cs.filter((c) => c.nivel === "critico").length, lista: cs.slice(0, 4) },
      hitos: {
        vencidos: [...f.hitosVencidos].sort((a, b) => a.fecha_plan.localeCompare(b.fecha_plan)).slice(0, 3).map((h) => ({ nombre: h.nombre, fecha: h.fecha_plan })),
        proximos: porProyecto(proximos, p.id).slice(0, 3).map((h) => ({ nombre: String(h.nombre), fecha: String(h.fecha_plan) })),
      },
      reporte: rep ? { semana: Number(rep.semana), anio: Number(rep.anio), estado: rep.estado_reportado as Color, logros: (rep.logros as string | null) ?? null, alertas: (rep.alertas as string | null) ?? null, decisiones: (rep.decisiones_requeridas as string | null) ?? null } : null,
      decisiones: decisiones.filter((x) => x.proyectoId === p.id).map((x) => ({ tipo: x.tipo, detalle: x.detalle })),
    };
  });
  const orden = new Map(ordenarPorCodigo(informes.map((i) => i.proyecto)).map((p, k) => [p.id, k]));
  return informes.sort((a, b) => (orden.get(a.proyecto.id) ?? 0) - (orden.get(b.proyecto.id) ?? 0));
}
