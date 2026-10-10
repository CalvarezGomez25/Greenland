import { Suspense } from "react";
import Link from "next/link";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { formatearFechaHora } from "@/lib/formato";
import { TIPOS_ASESORIA, etiqueta } from "@/lib/interventoria";
import { Aviso, Titulo } from "@/components/ui";
import { AvisoResultado } from "@/components/aviso-resultado";
import { FormularioRegistro } from "../../r/formulario-registro";
import { crearAsesoria } from "../acciones";
import type { CampoDef } from "@/lib/registros/tipos";

type A = { id: string; tema: string; tipo: string; fuentes: string | null; conclusiones: string; recomendacion: string; autor_id: string; fecha: string };

async function Contenido({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  const { id } = await params;
  const { ok } = await searchParams;
  const { supabase, permisos } = await cargarProyecto(id);
  const [{ data, error }, { data: per }] = await Promise.all([
    supabase.from("asesorias").select("id, tema, tipo, fuentes, conclusiones, recomendacion, autor_id, fecha").eq("proyecto_id", id).order("fecha", { ascending: false }).limit(200),
    supabase.from("perfiles").select("id, nombre"),
  ]);
  const items = (data ?? []) as A[];
  const nombres = new Map(((per ?? []) as { id: string; nombre: string }[]).map((p) => [p.id, p.nombre]));
  const campos: CampoDef[] = [
    { nombre: "tema", etiqueta: "Tema", tipo: "texto", obligatorio: true, max: 200 },
    { nombre: "tipo", etiqueta: "Tipo", tipo: "seleccion", obligatorio: true, opciones: TIPOS_ASESORIA.map(([valor, etiqueta]) => ({ valor, etiqueta })) },
    { nombre: "fuentes", etiqueta: "Fuentes", tipo: "area" },
    { nombre: "conclusiones", etiqueta: "Conclusiones", tipo: "area", obligatorio: true },
    { nombre: "recomendacion", etiqueta: "Recomendación", tipo: "area", obligatorio: true },
  ];
  return (
    <>
      <Link href={`/proyectos/${id}/interventoria`} className="text-sm font-medium text-leaf-600 hover:underline">← Interventoría</Link>
      <div className="mt-4"><Titulo>Asesoría para decisiones</Titulo></div>
      <p className="mt-3 max-w-3xl text-sm text-muted">Investigaciones y estudios de mercado que la interventoría aporta al gerente, incluido el apoyo a estudios previos y pliegos. No contrata diseños ni estudios.</p>
      <div className="mt-4"><AvisoResultado ok={ok} /></div>
      {error && <div className="mt-4"><Aviso>No se pudieron leer las asesorías{error.code ? ` (código ${error.code})` : ""}.</Aviso></div>}
      {items.length === 0 && !error ? <p className="mt-6 rounded-card bg-leaf-50 p-6 text-sm text-muted">Aún no hay asesorías.</p> : (
        <ul className="mt-6 flex flex-col gap-3">
          {items.map((a) => (
            <li key={a.id} className="rounded-card border border-soil-border p-4 text-sm">
              <p className="font-medium text-leaf-900">{a.tema} <span className="font-normal text-muted">· {etiqueta(TIPOS_ASESORIA, a.tipo)}</span></p>
              {a.fuentes && <p className="mt-1 whitespace-pre-wrap text-muted">Fuentes: {a.fuentes}</p>}
              <p className="mt-1 whitespace-pre-wrap"><strong>Conclusiones:</strong> {a.conclusiones}</p>
              <p className="mt-1 whitespace-pre-wrap"><strong>Recomendación:</strong> {a.recomendacion}</p>
              <p className="mt-1 text-xs text-muted">{nombres.get(a.autor_id) ?? "—"} · {formatearFechaHora(a.fecha)}</p>
            </li>
          ))}
        </ul>
      )}
      {permisos.interventor && (
        <section className="mt-8 rounded-card bg-leaf-50 p-5"><h2 className="mb-3 font-display text-xl font-bold text-leaf-700">Nueva asesoría</h2>
          <FormularioRegistro accion={crearAsesoria.bind(null, id)} campos={campos} opciones={{}} iniciales={{}} editando={false} volverA={`/proyectos/${id}/interventoria`} /></section>
      )}
    </>
  );
}

export default function PaginaAsesorias({ params, searchParams }: PageProps<"/proyectos/[id]/interventoria/asesorias">) {
  return <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><Contenido params={params} searchParams={searchParams} /></Suspense>;
}
