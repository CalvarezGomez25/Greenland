import { Suspense } from "react";
import Link from "next/link";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { formatearFecha } from "@/lib/formato";
import { CLIMAS, etiqueta, resumenBitacora, type EntradaResumen } from "@/lib/obra/bitacora";
import { Aviso, Titulo, claseBoton } from "@/components/ui";
import { AvisoResultado } from "@/components/aviso-resultado";

type Fila = EntradaResumen & { id: string; clima: string; personal_propio: number; personal_subcontratistas: number; incidente_tipo: string | null; supervisor_id: string };

async function Contenido({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  const { id } = await params;
  const { ok } = await searchParams;
  const { supabase, proyecto, permisos } = await cargarProyecto(id);
  const [{ data, error }, { data: perfiles }] = await Promise.all([
    supabase.from("bitacoras").select("id, fecha, es_interventoria, clima, personal_propio, personal_subcontratistas, horas_perdidas_total, retraso_causa, incidente_tipo, supervisor_id").eq("proyecto_id", id).order("fecha", { ascending: false }).limit(300),
    supabase.from("perfiles").select("id, nombre"),
  ]);
  const filas = (data ?? []) as Fila[];
  const nombres = new Map(((perfiles ?? []) as { id: string; nombre: string }[]).map((p) => [p.id, p.nombre]));
  const r = resumenBitacora(filas);
  const puedeRegistrar = permisos.gestionar || permisos.supervisor || permisos.interventor;

  return (
    <>
      <Link href={`/proyectos/${id}`} className="text-sm font-medium text-leaf-600 hover:underline">← Volver al proyecto</Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <Titulo>Bitácora de obra</Titulo>
        {puedeRegistrar && <Link href={`/proyectos/${id}/bitacora/nueva`} className={`${claseBoton.primario} !h-12`}>Nueva entrada</Link>}
      </div>
      <p className="mt-3 text-sm text-muted">{proyecto.nombre}</p>
      <div className="mt-4"><AvisoResultado ok={ok} /></div>
      {error && <div className="mt-4"><Aviso>No se pudo leer la bitácora{error.code ? ` (código ${error.code})` : ""}.</Aviso></div>}

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Resumen">
        {([["Entradas", String(r.entradas)], ["Horas perdidas", r.horasPerdidas.toLocaleString("es-CO")], ["Retrasos", String(r.retrasos)], ["Incidentes", `${r.incidentes}${r.accidentes ? ` (${r.accidentes} accidente(s))` : ""}`]] as [string, string][]).map(([t, v]) => (
          <div key={t} className="rounded-card bg-leaf-100 p-4"><p className="text-xs font-medium uppercase tracking-wider text-leaf-800">{t}</p><p className="mt-1 font-display text-xl font-bold text-leaf-700">{v}</p></div>
        ))}
      </section>

      {filas.length === 0 && !error ? (
        <p className="mt-6 rounded-card bg-leaf-50 p-6 text-sm text-muted">Aún no hay entradas.</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {filas.map((f) => (
            <li key={f.id}>
              <Link href={`/proyectos/${id}/bitacora/${f.id}`} className="block rounded-card border border-soil-border p-4 hover:shadow-card">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-display text-lg font-bold text-leaf-700">{formatearFecha(f.fecha)}</p>
                  <p className="text-sm text-muted">{nombres.get(f.supervisor_id) ?? "—"}{f.es_interventoria ? " · Interventoría" : ""}</p>
                </div>
                <p className="mt-1 text-sm">{etiqueta(CLIMAS, f.clima)} · {f.personal_propio + f.personal_subcontratistas} personas · {Number(f.horas_perdidas_total).toLocaleString("es-CO")} h perdidas{f.retraso_causa ? " · con retraso" : ""}{f.incidente_tipo ? " · con incidente" : ""}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function PaginaBitacora({ params, searchParams }: PageProps<"/proyectos/[id]/bitacora">) {
  return <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><Contenido params={params} searchParams={searchParams} /></Suspense>;
}
