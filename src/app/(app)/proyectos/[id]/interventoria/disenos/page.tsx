import { Suspense } from "react";
import Link from "next/link";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { formatearFechaHora } from "@/lib/formato";
import { ESTADOS_REVISION, etiqueta } from "@/lib/interventoria";
import { Aviso, Titulo, claseBoton } from "@/components/ui";
import { BotonEnviar } from "@/components/boton-enviar";
import { AvisoResultado } from "@/components/aviso-resultado";
import { FormularioRegistro } from "../../r/formulario-registro";
import { cargarOpciones } from "../datos";
import { marcarDisenoListo, revisarDiseno } from "../acciones";
import type { CampoDef } from "@/lib/registros/tipos";

type R = { id: string; documento_id: string; version: number; disciplina: string; ciclo: number; estado: string; observaciones: string | null; fecha: string };

async function Contenido({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { id } = await params;
  const { ok, error: errorUrl } = await searchParams;
  const { supabase, proyecto, permisos } = await cargarProyecto(id);
  const [o, { data: rs }, { data: est }, { data: vs }] = await Promise.all([
    cargarOpciones(supabase, id, proyecto.portafolio_id),
    supabase.from("revisiones_diseno").select("id, documento_id, version, disciplina, ciclo, estado, observaciones, fecha").eq("proyecto_id", id).order("ciclo", { ascending: false }),
    supabase.from("diseno_estado").select("listo_licitar, fecha").eq("proyecto_id", id).maybeSingle(),
    supabase.from("documento_versiones").select("documento_id, version").eq("proyecto_id", id),
  ]);
  const revs = (rs ?? []) as R[];
  const ultVer = new Map<string, number>();
  for (const v of (vs ?? []) as { documento_id: string; version: number }[]) ultVer.set(v.documento_id, Math.max(ultVer.get(v.documento_id) ?? 0, v.version));
  const campos: CampoDef[] = [
    { nombre: "documento_id", etiqueta: "Plano (entregable de diseño)", tipo: "seleccion", obligatorio: true, opcionesDe: "planos" },
    { nombre: "disciplina", etiqueta: "Disciplina", tipo: "seleccion", obligatorio: true, opcionesDe: "disciplinas" },
    { nombre: "estado", etiqueta: "Resultado de la revisión", tipo: "seleccion", obligatorio: true, opciones: ESTADOS_REVISION.map(([valor, etiqueta]) => ({ valor, etiqueta })) },
    { nombre: "observaciones", etiqueta: "Observaciones", tipo: "area", ayuda: "Obligatorias si el resultado es “Con observaciones”." },
  ];
  const listo = Boolean(est?.listo_licitar);

  return (
    <>
      <Link href={`/proyectos/${id}/interventoria`} className="text-sm font-medium text-leaf-600 hover:underline">← Interventoría</Link>
      <div className="mt-4"><Titulo>Revisión de diseños</Titulo></div>
      <p className="mt-3 max-w-3xl text-sm text-muted">Cada plano (subido en Documentos) tiene ciclos de revisión. El diseño solo puede marcarse como listo para licitar con TODOS los planos aprobados en su última versión.</p>
      <div className="mt-4 flex flex-col gap-2"><AvisoResultado ok={ok} />{errorUrl && <Aviso>{errorUrl.slice(0, 400)}</Aviso>}</div>

      <section className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-card bg-leaf-100 p-5">
        <p className="font-medium text-leaf-900">{listo ? "✔ El diseño está marcado como listo para licitar." : "El diseño aún no está marcado como listo para licitar."}</p>
        {permisos.gestionar && <form action={marcarDisenoListo.bind(null, id, !listo)}><BotonEnviar className={listo ? claseBoton.contorno : claseBoton.primario} textoEnviando="Guardando…">{listo ? "Quitar la marca" : "Marcar listo para licitar"}</BotonEnviar></form>}
      </section>

      <section className="mt-6" aria-label="Planos">
        {o.planos.length === 0 ? <p className="rounded-card bg-leaf-50 p-6 text-sm text-muted">No hay planos. Súbelos en Documentos con tipo “Plano”.</p> : (
          <ul className="flex flex-col gap-3">
            {o.planos.map((p) => {
              const propias = revs.filter((r) => r.documento_id === p.valor);
              const u = propias[0];
              const vigente = u && u.version === (ultVer.get(p.valor) ?? 0);
              return (
                <li key={p.valor} className="rounded-card border border-soil-border p-4">
                  <p className="font-medium">{p.etiqueta}</p>
                  <p className="text-sm text-muted">{u ? `Última revisión: ciclo ${u.ciclo} · ${etiqueta(ESTADOS_REVISION, u.estado)} · versión ${u.version} del plano${vigente ? "" : " (hay una versión más nueva sin revisar)"}` : "Sin revisiones"}</p>
                  {propias.length > 0 && (
                    <details className="mt-2 text-sm"><summary className="cursor-pointer font-medium text-leaf-600">Historial de ciclos</summary>
                      <ul className="mt-2 divide-y divide-soil-border">{propias.map((r) => <li key={r.id} className="py-2"><strong>Ciclo {r.ciclo}</strong> · {r.disciplina} · {etiqueta(ESTADOS_REVISION, r.estado)} · {formatearFechaHora(r.fecha)}{r.observaciones && <p className="whitespace-pre-wrap text-muted">{r.observaciones}</p>}</li>)}</ul></details>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {permisos.interventor && o.planos.length > 0 && (
        <section className="mt-8 rounded-card bg-leaf-50 p-5"><h2 className="mb-3 font-display text-xl font-bold text-leaf-700">Registrar una revisión</h2>
          <FormularioRegistro accion={revisarDiseno.bind(null, id)} campos={campos} opciones={{ planos: o.planos, disciplinas: o.disciplinas }} iniciales={{}} editando={false} volverA={`/proyectos/${id}/interventoria`} /></section>
      )}
    </>
  );
}

export default function PaginaDisenos({ params, searchParams }: PageProps<"/proyectos/[id]/interventoria/disenos">) {
  return <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><Contenido params={params} searchParams={searchParams} /></Suspense>;
}
