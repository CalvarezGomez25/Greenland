import { Suspense } from "react";
import Link from "next/link";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { formatearFecha } from "@/lib/formato";
import { cargarDatosKpi, hoyColombia } from "@/lib/pmo/cargar";
import { calcularKpis } from "@/lib/pmo/kpis";
import type { FilaParametro } from "@/lib/pmo/parametros";
import { Aviso, Titulo } from "@/components/ui";
import { Semaforo } from "@/components/semaforo";
import { TablaKpis } from "@/components/kpis";
import { AvisoResultado } from "@/components/aviso-resultado";
import { crearReporte, guardarEvaluacion } from "./acciones";
import { FormularioEvaluacion, FormularioNuevoReporte } from "./formularios";
import type { Color } from "@/lib/pmo/semaforo";

type Fila = { id: string; anio: number; semana: number; fecha_reporte: string; estado_reportado: Color; enviado_en: string | null };

async function Contenido({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  const { id } = await params;
  const { ok } = await searchParams;
  const { supabase, proyecto, permisos } = await cargarProyecto(id);
  if (permisos.interventor) return <Aviso>Tu rol no incluye los reportes semanales.</Aviso>;
  const [{ data, error }, { data: pars }, datosKpi] = await Promise.all([
    supabase.from("reportes_semanales").select("id, anio, semana, fecha_reporte, estado_reportado, enviado_en").eq("proyecto_id", id).order("anio", { ascending: false }).order("semana", { ascending: false }).limit(200),
    supabase.from("parametros").select("ambito, ambito_id, clave, valor"),
    cargarDatosKpi(supabase, [id]),
  ]);
  const hoy = hoyColombia();
  const kpis = calcularKpis(datosKpi, { hoy, parametros: (pars ?? []) as FilaParametro[], contexto: { proyectoId: id, portafolioId: proyecto.portafolio_id } });
  const filas = (data ?? []) as Fila[];
  const puedeEvaluar = permisos.gestionar || permisos.patrocinador;

  return (
    <>
      <Link href={`/proyectos/${id}`} className="text-sm font-medium text-leaf-600 hover:underline">← Volver al proyecto</Link>
      <div className="mt-4"><Titulo>Reporte semanal y KPIs</Titulo></div>
      <p className="mt-3 text-sm text-muted">{proyecto.nombre} · semana calendario ISO (lunes a domingo)</p>
      <div className="mt-4"><AvisoResultado ok={ok} /></div>

      <section className="mt-6" aria-labelledby="t-kpis">
        <h2 id="t-kpis" className="font-display text-2xl font-bold text-leaf-700">KPIs de gestión del proyecto</h2>
        <div className="mt-3"><TablaKpis series={kpis} /></div>
        <p className="mt-2 text-sm"><Link href={`/proyectos/${id}/r/hitos`} className="font-medium text-leaf-600 hover:underline">Hitos</Link> · <Link href={`/proyectos/${id}/r/reuniones`} className="font-medium text-leaf-600 hover:underline">Reuniones</Link></p>
      </section>

      <section className="mt-8" aria-labelledby="t-rep">
        <h2 id="t-rep" className="font-display text-2xl font-bold text-leaf-700">Reportes</h2>
        {error && <div className="mt-3"><Aviso>No se pudieron leer los reportes{error.code ? ` (código ${error.code})` : ""}.</Aviso></div>}
        {filas.length === 0 && !error ? (
          <p className="mt-3 rounded-card bg-leaf-50 p-5 text-sm text-muted">Aún no hay reportes.</p>
        ) : (
          <ul className="mt-3 divide-y divide-soil-border rounded-card border border-soil-border">
            {filas.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <span><strong>Semana {r.semana} de {r.anio}</strong> · {formatearFecha(r.fecha_reporte)}</span>
                <span className="flex items-center gap-3">
                  <Semaforo color={r.estado_reportado} />
                  <span className="text-muted">{r.enviado_en ? "Enviado" : "Borrador"}</span>
                  <Link href={`/proyectos/${id}/reportes/${r.id}`} className="font-medium text-leaf-600 hover:underline">{r.enviado_en || !permisos.gestionar ? "Ver" : "Editar"}</Link>
                </span>
              </li>
            ))}
          </ul>
        )}
        {permisos.gestionar && (
          <div className="mt-5 rounded-card bg-leaf-50 p-5"><h3 className="mb-3 font-display text-lg font-bold text-leaf-700">Nuevo reporte</h3><FormularioNuevoReporte accion={crearReporte.bind(null, id)} hoy={hoy} /></div>
        )}
      </section>

      {puedeEvaluar && (
        <section className="mt-8 rounded-card bg-leaf-50 p-5" aria-labelledby="t-eval">
          <h2 id="t-eval" className="mb-1 font-display text-lg font-bold text-leaf-700">Satisfacción del patrocinador</h2>
          <p className="mb-3 text-sm text-muted">Encuesta simple de 1 a 5, una por mes (captura manual).</p>
          <FormularioEvaluacion accion={guardarEvaluacion.bind(null, id)} mesActual={hoy.slice(0, 7)} />
        </section>
      )}
    </>
  );
}

export default function PaginaReportes({ params, searchParams }: PageProps<"/proyectos/[id]/reportes">) {
  return <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><Contenido params={params} searchParams={searchParams} /></Suspense>;
}
