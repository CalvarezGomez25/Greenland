import { Suspense } from "react";
import Link from "next/link";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { formatearFechaHora } from "@/lib/formato";
import { RECOMENDACIONES_PROVEEDOR, etiqueta } from "@/lib/interventoria";
import { Aviso, Titulo } from "@/components/ui";
import { AvisoResultado } from "@/components/aviso-resultado";
import { FormularioRegistro } from "../../r/formulario-registro";
import { cargarOpciones } from "../datos";
import { evaluarProveedor } from "../acciones";
import type { CampoDef } from "@/lib/registros/tipos";

type E = { id: string; contrato_id: string | null; proveedor: string; puntajes: Record<string, number>; puntaje_total: number | string; recomendacion: string; comentario: string | null; fecha: string; evaluador_id: string };

async function Contenido({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  const { id } = await params;
  const { ok } = await searchParams;
  const { supabase, proyecto, permisos } = await cargarProyecto(id);
  const [o, { data, error }, { data: per }] = await Promise.all([
    cargarOpciones(supabase, id, proyecto.portafolio_id),
    supabase.from("evaluaciones_proveedor").select("id, contrato_id, proveedor, puntajes, puntaje_total, recomendacion, comentario, fecha, evaluador_id").eq("proyecto_id", id).order("fecha", { ascending: false }).limit(200),
    supabase.from("perfiles").select("id, nombre"),
  ]);
  const evals = (data ?? []) as E[];
  const nombres = new Map(((per ?? []) as { id: string; nombre: string }[]).map((p) => [p.id, p.nombre]));
  const campos: CampoDef[] = [
    { nombre: "proveedor", etiqueta: "Proveedor o contratista", tipo: "texto", obligatorio: true, max: 200 },
    { nombre: "contrato_id", etiqueta: "Contrato", tipo: "seleccion", opcionesDe: "contratos" },
    ...o.criterios.map((c, i): CampoDef => ({ nombre: `criterio_${i}`, etiqueta: `${c} (1 a 5)`, tipo: "entero", obligatorio: true, min: 1, max: 5 })),
    { nombre: "recomendacion", etiqueta: "Recomendación", tipo: "seleccion", obligatorio: true, opciones: RECOMENDACIONES_PROVEEDOR.map(([valor, etiqueta]) => ({ valor, etiqueta })), ayuda: "La interventoría recomienda; la selección y la contratación son de la entidad." },
    { nombre: "comentario", etiqueta: "Comentario", tipo: "area" },
  ];
  return (
    <>
      <Link href={`/proyectos/${id}/interventoria`} className="text-sm font-medium text-leaf-600 hover:underline">← Interventoría</Link>
      <div className="mt-4"><Titulo>Evaluación de proveedores y contratistas</Titulo></div>
      <p className="mt-3 max-w-3xl text-sm text-muted">Criterios configurables (escala 1 a 5): {o.criterios.join(", ")}. El puntaje total es el promedio.</p>
      <div className="mt-4"><AvisoResultado ok={ok} /></div>
      {error && <div className="mt-4"><Aviso>No se pudieron leer las evaluaciones{error.code ? ` (código ${error.code})` : ""}.</Aviso></div>}
      {evals.length === 0 && !error ? <p className="mt-6 rounded-card bg-leaf-50 p-6 text-sm text-muted">Aún no hay evaluaciones.</p> : (
        <ul className="mt-6 flex flex-col gap-3">
          {evals.map((e) => (
            <li key={e.id} className="rounded-card border border-soil-border p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium text-leaf-900">{e.proveedor}</p><p className="font-display text-lg font-bold text-leaf-700">{Number(e.puntaje_total).toLocaleString("es-CO", { minimumFractionDigits: 2 })} / 5 · {etiqueta(RECOMENDACIONES_PROVEEDOR, e.recomendacion)}</p></div>
              <p className="mt-1 text-muted">{Object.entries(e.puntajes).map(([k, v]) => `${k}: ${v}`).join(" · ")}</p>
              {e.comentario && <p className="mt-1 whitespace-pre-wrap">{e.comentario}</p>}
              <p className="mt-1 text-xs text-muted">{nombres.get(e.evaluador_id) ?? "—"} · {formatearFechaHora(e.fecha)}</p>
            </li>
          ))}
        </ul>
      )}
      {permisos.interventor && o.criterios.length > 0 && (
        <section className="mt-8 rounded-card bg-leaf-50 p-5"><h2 className="mb-3 font-display text-xl font-bold text-leaf-700">Nueva evaluación</h2>
          <FormularioRegistro accion={evaluarProveedor.bind(null, id)} campos={campos} opciones={{ contratos: o.contratosObra }} iniciales={{}} editando={false} volverA={`/proyectos/${id}/interventoria`} /></section>
      )}
    </>
  );
}

export default function PaginaEvaluaciones({ params, searchParams }: PageProps<"/proyectos/[id]/interventoria/evaluaciones">) {
  return <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><Contenido params={params} searchParams={searchParams} /></Suspense>;
}
