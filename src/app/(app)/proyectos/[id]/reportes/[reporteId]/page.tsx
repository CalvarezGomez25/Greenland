import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { ES_UUID, formatearFecha, formatearFechaHora } from "@/lib/formato";
import { desdeJson } from "@/lib/presupuesto/dinero";
import { indicadoresBorrador } from "@/lib/pmo/reporte";
import { BotonesExportar } from "@/components/botones-exportar";
import { centavos, indice, porcentaje } from "@/lib/pmo/formato";
import { Aviso, Titulo } from "@/components/ui";
import { Semaforo } from "@/components/semaforo";
import { AvisoResultado } from "@/components/aviso-resultado";
import { guardarReporte } from "../acciones";
import { FormularioReporte } from "../formularios";

type Reporte = Record<string, string | number | null | Record<string, number | string | null>> & { id: string };
type Foto = { fecha_corte?: string; bac?: number | string; pv?: number | string; ev?: number | string; ac?: number | string; spi?: number | null; cpi?: number | null; avance_fisico?: number | null; avance_presupuestal?: number | null; hitos_cumplidos_semana?: number };

function Indicadores({ foto, titulo }: { foto: Foto; titulo: string }) {
  const items: [string, string][] = [
    ["SPI", indice(foto.spi ?? null)], ["CPI", indice(foto.cpi ?? null)],
    ["Avance físico", porcentaje(foto.avance_fisico ?? null)], ["Avance presupuestal", porcentaje(foto.avance_presupuestal ?? null)],
    ["Ejecutado (AC, COP)", foto.ac !== undefined ? centavos(desdeJson(foto.ac, 2)) : "—"], ["Hitos cumplidos en la semana", String(foto.hitos_cumplidos_semana ?? 0)],
  ];
  return (
    <section aria-label={titulo} className="mt-6">
      <h2 className="font-display text-xl font-bold text-leaf-700">{titulo}</h2>
      {foto.fecha_corte && <p className="text-sm text-muted">Medición de valor ganado del {formatearFecha(foto.fecha_corte)}</p>}
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map(([t, v]) => <div key={t} className="rounded-card bg-leaf-100 p-4"><p className="text-xs font-medium uppercase tracking-wider text-leaf-800">{t}</p><p className="mt-1 font-display text-xl font-bold text-leaf-700">{v}</p></div>)}
      </div>
    </section>
  );
}

async function Contenido({ params, searchParams }: { params: Promise<{ id: string; reporteId: string }>; searchParams: Promise<{ ok?: string }> }) {
  const { id, reporteId } = await params;
  const { ok } = await searchParams;
  if (!ES_UUID.test(reporteId)) notFound();
  const { supabase, proyecto, permisos } = await cargarProyecto(id);
  if (permisos.interventor) return <Aviso>Tu rol no incluye los reportes semanales.</Aviso>;
  const { data } = await supabase.from("reportes_semanales").select("*").eq("id", reporteId).eq("proyecto_id", id).maybeSingle();
  if (!data) notFound();
  const r = data as unknown as Reporte;
  const enviado = Boolean(r.enviado_en);

  const foto: Foto = enviado ? ((r.foto ?? {}) as Foto) : await indicadoresBorrador(supabase, id, String(r.fecha_reporte));

  const iniciales: Record<string, string> = {};
  for (const k of ["estado_reportado", "proxima_revision", "logros", "alertas", "decisiones_requeridas", "proximos_hitos"]) iniciales[k] = (r[k] as string | null) ?? "";

  return (
    <>
      <Link href={`/proyectos/${id}/reportes`} className="text-sm font-medium text-leaf-600 hover:underline">← Volver a los reportes</Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div><Titulo>{`Semana ${r.semana} de ${r.anio}`}</Titulo><p className="mt-2 text-sm text-muted">{proyecto.nombre} · {formatearFecha(String(r.fecha_reporte))}{enviado ? ` · Enviado el ${formatearFechaHora(String(r.enviado_en))}` : " · Borrador"}</p></div>
        <div className="flex flex-col items-end gap-2"><Semaforo color={r.estado_reportado as "verde" | "amarillo" | "rojo"} /><BotonesExportar base={`/proyectos/${id}/exportar/reporte?reporte=${reporteId}`} /></div>
      </div>
      <div className="mt-4"><AvisoResultado ok={ok === "enviado" ? "guardado" : ok} />{ok === "enviado" && <Aviso tipo="ok">Reporte enviado. Los indicadores quedaron fijos.</Aviso>}</div>

      <Indicadores foto={foto} titulo={enviado ? "Indicadores al enviar (histórico)" : "Indicadores actuales (se fijan al enviar)"} />

      <section className="mt-8" aria-label="Contenido del reporte">
        {permisos.gestionar && !enviado ? (
          <FormularioReporte accion={guardarReporte.bind(null, id, reporteId)} iniciales={iniciales} />
        ) : (
          <dl className="grid gap-4 sm:grid-cols-2">
            {([["logros", "Logros de la semana"], ["alertas", "Alertas y riesgos activos"], ["decisiones_requeridas", "Decisiones requeridas de la dirección"], ["proximos_hitos", "Próximos hitos (2 semanas)"]] as [string, string][]).map(([k, t]) => (
              <div key={k}><dt className="text-xs font-medium uppercase tracking-wider text-leaf-800">{t}</dt><dd className="mt-0.5 whitespace-pre-wrap">{(r[k] as string) || "—"}</dd></div>
            ))}
            <div><dt className="text-xs font-medium uppercase tracking-wider text-leaf-800">Próxima revisión</dt><dd className="mt-0.5">{r.proxima_revision ? formatearFecha(String(r.proxima_revision)) : "—"}</dd></div>
          </dl>
        )}
      </section>
    </>
  );
}

export default function PaginaReporte({ params, searchParams }: PageProps<"/proyectos/[id]/reportes/[reporteId]">) {
  return <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><Contenido params={params} searchParams={searchParams} /></Suspense>;
}
