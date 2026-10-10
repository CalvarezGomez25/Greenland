import { Suspense } from "react";
import Link from "next/link";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { formatearFecha, formatearFechaHora } from "@/lib/formato";
import { hoyColombia } from "@/lib/pmo/cargar";
import { Aviso, Titulo, claseBoton } from "@/components/ui";
import { BotonEnviar } from "@/components/boton-enviar";
import { AvisoResultado } from "@/components/aviso-resultado";
import { cerrarProyecto, reabrirProyecto } from "./acciones";
import { FormularioCierre } from "./formulario-cierre";

async function Contenido({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  const { id } = await params;
  const { ok } = await searchParams;
  const { supabase, proyecto, permisos } = await cargarProyecto(id);
  if (permisos.interventor) return <Aviso>Tu rol no incluye el cierre del proyecto.</Aviso>;
  const hoy = hoyColombia();
  const [{ data: cierre }, { data: lec }, { data: camb }, { count: pendientes }, { count: vencidos }, { data: perfiles }] = await Promise.all([
    supabase.from("cierres").select("fecha_entrega, receptor, observaciones, cerrado_por, cerrado_en").eq("proyecto_id", id).maybeSingle(),
    supabase.from("lecciones_aprendidas").select("id, categoria, descripcion, recomendacion").eq("proyecto_id", id).order("creado_en", { ascending: false }),
    supabase.from("cambios").select("id, codigo, lecciones").eq("proyecto_id", id).not("lecciones", "is", null).order("codigo"),
    supabase.from("cambios").select("id", { count: "exact", head: true }).eq("proyecto_id", id).not("estado_flujo", "in", "(cerrado,rechazado)"),
    supabase.from("hitos").select("id", { count: "exact", head: true }).eq("proyecto_id", id).is("fecha_real", null).eq("cancelado", false).lt("fecha_plan", hoy),
    supabase.from("perfiles").select("id, nombre"),
  ]);
  const cerrado = proyecto.estado === "cerrado";
  const nombres = new Map(((perfiles ?? []) as { id: string; nombre: string }[]).map((p) => [p.id, p.nombre]));
  const lecciones = (lec ?? []) as { id: string; categoria: string; descripcion: string; recomendacion: string | null }[];
  const deCambios = (camb ?? []) as { id: string; codigo: string; lecciones: string }[];

  return (
    <>
      <Link href={`/proyectos/${id}`} className="text-sm font-medium text-leaf-600 hover:underline">← Volver al proyecto</Link>
      <div className="mt-4"><Titulo>Cierre y lecciones aprendidas</Titulo></div>
      <p className="mt-3 text-sm text-muted">{proyecto.nombre}</p>
      <div className="mt-4"><AvisoResultado ok={ok} /></div>

      <section className="mt-6" aria-labelledby="t-cierre">
        <h2 id="t-cierre" className="font-display text-2xl font-bold text-leaf-700">Acta de entrega y cierre</h2>
        {cerrado && cierre ? (
          <div className="mt-3 rounded-card bg-leaf-100 p-5 text-sm">
            <p><strong>Proyecto cerrado.</strong> Entregado el {formatearFecha(cierre.fecha_entrega)} a {cierre.receptor}.</p>
            {cierre.observaciones && <p className="mt-1 whitespace-pre-wrap text-muted">{cierre.observaciones}</p>}
            <p className="mt-1 text-muted">Cerrado por {nombres.get(cierre.cerrado_por) ?? "—"} el {formatearFechaHora(cierre.cerrado_en)}. Ya no aparece en el dashboard activo; se consulta en el histórico.</p>
            {permisos.admin && <form action={reabrirProyecto.bind(null, id)} className="mt-3"><BotonEnviar className={claseBoton.contorno} textoEnviando="Reabriendo…">Reabrir el proyecto (administrador)</BotonEnviar></form>}
          </div>
        ) : permisos.gestionar ? (
          <div className="mt-3 flex flex-col gap-4">
            <ul className="rounded-card border border-soil-border p-4 text-sm" aria-label="Antes de cerrar">
              <li>{(pendientes ?? 0) > 0 ? <span className="text-danger">❌ Hay {pendientes} cambio(s) sin cerrar ni rechazar: <Link href={`/proyectos/${id}/cambios`} className="underline">resuélvelos</Link> para poder cerrar.</span> : "✅ No hay cambios pendientes."}</li>
              <li>{(vencidos ?? 0) > 0 ? <span>⚠️ Hay {vencidos} hito(s) vencido(s) sin cumplir: <Link href={`/proyectos/${id}/r/hitos`} className="underline">revísalos</Link> (no impide el cierre).</span> : "✅ No hay hitos vencidos."}</li>
              <li>✅ Registra las lecciones aprendidas abajo antes de cerrar.</li>
            </ul>
            <div className="rounded-card bg-leaf-50 p-5"><FormularioCierre accion={cerrarProyecto.bind(null, id)} hoy={hoy} /></div>
          </div>
        ) : <p className="mt-3 rounded-card bg-leaf-50 p-5 text-sm text-muted">El proyecto sigue abierto. El cierre lo registra el gerente.</p>}
      </section>

      <section className="mt-8" aria-labelledby="t-lec">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="t-lec" className="font-display text-2xl font-bold text-leaf-700">Lecciones aprendidas</h2>
          {permisos.gestionar && <Link href={`/proyectos/${id}/r/lecciones/nuevo`} className={claseBoton.secundario}>Agregar lección</Link>}
        </div>
        {lecciones.length === 0 ? <p className="mt-3 rounded-card bg-leaf-50 p-5 text-sm text-muted">Aún no hay lecciones registradas.</p> : (
          <ul className="mt-3 divide-y divide-soil-border rounded-card border border-soil-border text-sm">
            {lecciones.map((l) => (
              <li key={l.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div><p className="font-medium">{l.categoria}</p><p className="whitespace-pre-wrap">{l.descripcion}</p>{l.recomendacion && <p className="mt-1 whitespace-pre-wrap text-muted">Recomendación: {l.recomendacion}</p>}</div>
                {permisos.gestionar && <Link href={`/proyectos/${id}/r/lecciones/${l.id}`} className="font-medium text-leaf-600 hover:underline">Editar</Link>}
              </li>
            ))}
          </ul>
        )}
        {deCambios.length > 0 && (
          <div className="mt-6">
            <h3 className="font-display text-lg font-bold text-leaf-700">Lecciones consolidadas de los cambios</h3>
            <ul className="mt-2 divide-y divide-soil-border rounded-card border border-soil-border text-sm">
              {deCambios.map((c) => <li key={c.id} className="p-4"><Link href={`/proyectos/${id}/cambios/${c.id}`} className="font-medium text-leaf-700 hover:underline">{c.codigo}</Link><p className="whitespace-pre-wrap text-muted">{c.lecciones}</p></li>)}
            </ul>
          </div>
        )}
      </section>
    </>
  );
}

export default function PaginaCierre({ params, searchParams }: PageProps<"/proyectos/[id]/cierre">) {
  return <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><Contenido params={params} searchParams={searchParams} /></Suspense>;
}
