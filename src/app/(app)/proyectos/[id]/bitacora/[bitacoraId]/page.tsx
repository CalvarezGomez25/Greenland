import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { ES_UUID, formatearFecha, formatearFechaHora } from "@/lib/formato";
import { CAUSAS_RETRASO, CLIMAS, TIPOS_INCIDENTE, etiqueta } from "@/lib/obra/bitacora";
import { Aviso, Titulo, claseBoton } from "@/components/ui";
import { BotonEnviar } from "@/components/boton-enviar";
import { AvisoResultado } from "@/components/aviso-resultado";
import { comentarBitacora } from "../acciones";

type B = Record<string, string | number | boolean | null> & { id: string };

function Dato({ t, v }: { t: string; v: React.ReactNode }) {
  return <div><dt className="text-xs font-medium uppercase tracking-wider text-leaf-800">{t}</dt><dd className="mt-0.5 whitespace-pre-wrap text-leaf-900">{v || "—"}</dd></div>;
}

async function Contenido({ params, searchParams }: { params: Promise<{ id: string; bitacoraId: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { id, bitacoraId } = await params;
  const { ok, error: errorUrl } = await searchParams;
  if (!ES_UUID.test(bitacoraId)) notFound();
  const { supabase, permisos } = await cargarProyecto(id);
  const { data } = await supabase.from("bitacoras").select("*").eq("id", bitacoraId).eq("proyecto_id", id).maybeSingle();
  if (!data) notFound();
  const b = data as B;
  const [{ data: acts }, { data: fotos }, { data: coms }, { data: perfiles }] = await Promise.all([
    supabase.from("bitacora_actividades").select("id, tarea_id, avance_dia_pct, descripcion").eq("bitacora_id", bitacoraId),
    supabase.from("bitacora_fotos").select("id, ruta").eq("bitacora_id", bitacoraId).order("creado_en"),
    supabase.from("bitacora_comentarios").select("id, autor_id, tipo, texto, fecha").eq("bitacora_id", bitacoraId).order("fecha"),
    supabase.from("perfiles").select("id, nombre"),
  ]);
  const { data: tareas } = await supabase.from("tareas").select("id, nombre").eq("proyecto_id", id);
  const nombreTarea = new Map(((tareas ?? []) as { id: string; nombre: string }[]).map((t) => [t.id, t.nombre]));
  const nombres = new Map(((perfiles ?? []) as { id: string; nombre: string }[]).map((p) => [p.id, p.nombre]));
  const rutas = ((fotos ?? []) as { id: string; ruta: string }[]).map((f) => f.ruta);
  const firmadas = rutas.length ? (await supabase.storage.from("bitacora").createSignedUrls(rutas, 3600)).data ?? [] : [];

  return (
    <>
      <Link href={`/proyectos/${id}/bitacora`} className="text-sm font-medium text-leaf-600 hover:underline">← Volver a la bitácora</Link>
      <div className="mt-4"><Titulo>{formatearFecha(b.fecha as string)}</Titulo></div>
      <p className="mt-2 text-sm text-muted">{nombres.get(b.supervisor_id as string) ?? "—"}{b.es_interventoria ? " · Entrada de la interventoría" : ""}</p>
      <div className="mt-4 flex flex-col gap-2"><AvisoResultado ok={ok} />{errorUrl && <Aviso>{errorUrl.slice(0, 400)}</Aviso>}</div>

      <dl className="mt-6 grid gap-4 rounded-card bg-leaf-100 p-5 sm:grid-cols-3">
        <Dato t="Clima" v={etiqueta(CLIMAS, b.clima as string)} />
        <Dato t="Horas perdidas (total)" v={`${Number(b.horas_perdidas_total).toLocaleString("es-CO")} h (clima: ${Number(b.horas_perdidas_clima).toLocaleString("es-CO")} h)`} />
        <Dato t="Personal" v={`${b.personal_propio} propio · ${b.personal_subcontratistas} de subcontratistas`} />
      </dl>

      <section className="mt-6" aria-label="Actividades">
        <h2 className="font-display text-xl font-bold text-leaf-700">Actividades</h2>
        <ul className="mt-2 divide-y divide-soil-border rounded-card border border-soil-border text-sm">
          {((acts ?? []) as { id: string; tarea_id: string | null; avance_dia_pct: number | string; descripcion: string }[]).map((a) => (
            <li key={a.id} className="p-3"><p className="font-medium">{a.tarea_id ? nombreTarea.get(a.tarea_id) ?? "Tarea" : "Otra actividad"}{Number(a.avance_dia_pct) > 0 ? ` · +${Number(a.avance_dia_pct).toLocaleString("es-CO")} %` : ""}</p><p className="whitespace-pre-wrap text-muted">{a.descripcion}</p></li>
          ))}
        </ul>
      </section>

      {firmadas.length > 0 && (
        <section className="mt-6" aria-label="Fotos">
          <h2 className="font-display text-xl font-bold text-leaf-700">Fotos</h2>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {firmadas.map((f, i) => f.signedUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <a key={i} href={f.signedUrl} target="_blank" rel="noopener noreferrer"><img src={f.signedUrl} alt={`Foto ${i + 1} de la bitácora`} className="aspect-[4/3] w-full rounded-card object-cover" loading="lazy" /></a>
            ))}
          </div>
        </section>
      )}

      <dl className="mt-6 grid gap-4 rounded-card border border-soil-border p-5 sm:grid-cols-2">
        {b.retraso_causa && <Dato t="Retraso" v={`${etiqueta(CAUSAS_RETRASO, b.retraso_causa as string)} · ${b.retraso_horas} h — ${b.retraso_descripcion}`} />}
        {b.incidente_tipo && <Dato t="Incidente" v={`${etiqueta(TIPOS_INCIDENTE, b.incidente_tipo as string)} · ${b.incidente_persona} — ${b.incidente_descripcion}`} />}
        <Dato t="Materiales recibidos" v={b.materiales as string} /><Dato t="Equipos y maquinaria" v={b.equipos as string} />
        <Dato t="Visitas" v={b.visitas as string} /><Dato t="Instrucciones o cambios solicitados" v={b.instrucciones as string} />
        <Dato t="Observaciones" v={b.observaciones as string} />
      </dl>

      <section className="mt-8" aria-label="Interventoría y comentarios">
        <h2 className="font-display text-xl font-bold text-leaf-700">Visto bueno y comentarios</h2>
        {((coms ?? []) as { id: string; autor_id: string; tipo: string; texto: string | null; fecha: string }[]).length === 0 ? <p className="mt-2 text-sm text-muted">Sin comentarios.</p> : (
          <ul className="mt-2 divide-y divide-soil-border rounded-card border border-soil-border text-sm">
            {((coms ?? []) as { id: string; autor_id: string; tipo: string; texto: string | null; fecha: string }[]).map((c) => (
              <li key={c.id} className="p-3"><p><strong>{c.tipo === "visto_bueno" ? "Visto bueno" : "Comentario"}</strong> · {nombres.get(c.autor_id) ?? "—"} · {formatearFechaHora(c.fecha)}</p>{c.texto && <p className="whitespace-pre-wrap text-muted">{c.texto}</p>}</li>
            ))}
          </ul>
        )}
        {(permisos.interventor || permisos.gestionar) && (
          <div className="mt-4 flex flex-col gap-4 rounded-card bg-leaf-50 p-5">
            {permisos.interventor && <form action={comentarBitacora.bind(null, id, bitacoraId, "visto_bueno")}><BotonEnviar className={claseBoton.secundario} textoEnviando="Registrando…">Dar visto bueno</BotonEnviar></form>}
            <form action={comentarBitacora.bind(null, id, bitacoraId, "comentario")} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5"><span className="text-[13px] font-medium text-leaf-800">Comentario</span><textarea name="texto" rows={2} maxLength={2000} required className="w-full rounded-[10px] border border-soil-border bg-white px-3.5 py-2.5 text-[15px]" /></label>
              <div><BotonEnviar className={claseBoton.primario} textoEnviando="Enviando…">Agregar comentario</BotonEnviar></div>
            </form>
          </div>
        )}
      </section>
    </>
  );
}

export default function PaginaEntradaBitacora({ params, searchParams }: PageProps<"/proyectos/[id]/bitacora/[bitacoraId]">) {
  return <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><Contenido params={params} searchParams={searchParams} /></Suspense>;
}
