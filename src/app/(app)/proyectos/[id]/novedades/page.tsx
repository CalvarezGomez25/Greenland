import { Suspense } from "react";
import Link from "next/link";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { formatearFecha } from "@/lib/formato";
import { ETIQUETA_TIPO_CONTRATO } from "@/lib/obra/contratos";
import { Aviso, Campo, Titulo, claseBoton } from "@/components/ui";
import { AvisoResultado } from "@/components/aviso-resultado";
import { BotonEnviar } from "@/components/boton-enviar";
import { revisarNovedad } from "./acciones";
import { TIPOS_NOVEDAD, TIPOS_QUE_SE_APLICAN_SOLOS } from "@/lib/obra/novedades";
import { Ayuda } from "@/components/ayuda";

type N = { id: string; contrato_id: string; tipo: string; fecha: string; descripcion: string; fotos: string[]; estado: string; nota_revision: string | null; creado_en: string };
const ETIQ_ESTADO: Record<string, string> = { pendiente: "Pendiente de revisión", aplicada: "Aplicada", descartada: "Descartada" };
const APLICA_SOLA = TIPOS_QUE_SE_APLICAN_SOLOS;

async function Contenido({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { id } = await params;
  const { ok, error: errorUrl } = await searchParams;
  const { supabase, proyecto, permisos } = await cargarProyecto(id);
  const [{ data: ns, error }, { data: cs }] = await Promise.all([
    supabase.from("contrato_novedades").select("id, contrato_id, tipo, fecha, descripcion, fotos, estado, nota_revision, creado_en").eq("proyecto_id", id).order("creado_en", { ascending: false }).limit(200),
    supabase.from("contratos").select("id, tipo, contratista").eq("proyecto_id", id),
  ]);
  const novedades = (ns ?? []) as N[];
  const contratos = new Map(((cs ?? []) as { id: string; tipo: string; contratista: string }[]).map((c) => [c.id, `${c.contratista} · ${ETIQUETA_TIPO_CONTRATO[c.tipo] ?? c.tipo}`]));
  const rutas = novedades.flatMap((n) => n.fotos).slice(0, 300);
  const firmadas = rutas.length ? ((await supabase.storage.from("novedades").createSignedUrls(rutas, 3600)).data ?? []) : [];
  const url = new Map(firmadas.filter((f): f is typeof f & { path: string; signedUrl: string } => !!f.path && !!f.signedUrl).map((f) => [f.path, f.signedUrl]));
  const pendientes = novedades.filter((n) => n.estado === "pendiente");
  const resto = novedades.filter((n) => n.estado !== "pendiente");

  const tarjeta = (n: N, revisar: boolean) => (
    <li key={n.id} className="rounded-card border border-soil-border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium text-leaf-900">{TIPOS_NOVEDAD.find(([k]) => k === n.tipo)?.[1] ?? n.tipo}</p>
        <span className="text-xs text-muted">{formatearFecha(n.fecha)} · {ETIQ_ESTADO[n.estado]}</span>
      </div>
      <p className="text-xs text-muted">{contratos.get(n.contrato_id) ?? "Contrato"}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm">{n.descripcion}</p>
      {n.fotos.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {n.fotos.map((f) => { const u = url.get(f); return u ? (
            <li key={f}>
              <a href={u} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt="Foto de la novedad" className="h-24 w-24 rounded-card border border-soil-border object-cover" />
              </a>
            </li>
          ) : null; })}
        </ul>
      )}
      {n.nota_revision && <p className="mt-2 text-xs text-muted">Revisión: {n.nota_revision}</p>}
      {revisar && permisos.gestionar && (
        <div className="mt-3 flex flex-wrap items-end gap-3 rounded-card bg-leaf-50 p-3">
          <form action={revisarNovedad.bind(null, id, n.id, "aplicar")} className="flex flex-wrap items-end gap-2">
            <Campo etiqueta="Nota (opcional)" name="nota" maxLength={500} className="min-w-[200px]" />
            <BotonEnviar className={claseBoton.primario} textoEnviando="Aplicando…">{APLICA_SOLA.has(n.tipo) ? "Aplicar al contrato" : "Marcar como aplicada"}</BotonEnviar>
          </form>
          <form action={revisarNovedad.bind(null, id, n.id, "descartar")} className="flex flex-wrap items-end gap-2">
            <Campo etiqueta="Motivo para descartar" name="nota" required maxLength={500} className="min-w-[200px]" />
            <BotonEnviar className={claseBoton.contorno} textoEnviando="Descartando…">Descartar</BotonEnviar>
          </form>
          <p className="w-full text-xs text-muted">{APLICA_SOLA.has(n.tipo) ? (n.tipo === "acta_inicio" ? "Al aplicar, la fecha queda como acta de inicio del contrato." : "Al aplicar, se registra una modificación firmada en el contrato.") : "Las demás novedades no cambian datos solas: regístralas en el contrato (póliza, modificación o comunicación) y márcala aplicada."}</p>
        </div>
      )}
    </li>
  );

  return (
    <>
      <Link href={`/proyectos/${id}`} className="text-sm font-medium text-leaf-600 hover:underline">← Volver al proyecto</Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <span className="inline-flex items-center gap-2"><Titulo>Novedades de campo</Titulo><Ayuda tema="novedad_campo" /></span>
        <Link href={`/proyectos/${id}/novedades/nueva`} className={claseBoton.primario}>Registrar novedad</Link>
      </div>
      <p className="mt-3 max-w-3xl text-sm text-muted">{proyecto.nombre} · lo que pasa en obra con un contrato (acta de inicio firmada, póliza, suspensión…), con foto, desde el celular. La gerencia la revisa antes de aplicarla: una novedad nunca cambia el contrato por sí sola.</p>
      <div className="mt-4 flex flex-col gap-2"><AvisoResultado ok={ok} />{errorUrl && <Aviso>{errorUrl.slice(0, 400)}</Aviso>}</div>
      {error && <div className="mt-4"><Aviso>No se pudieron leer las novedades{error.code ? ` (código ${error.code})` : ""}.</Aviso></div>}
      <h2 className="mt-6 font-display text-2xl font-bold text-leaf-700">Por revisar ({pendientes.length}) <Ayuda tema="novedad_revision" /></h2>
      {pendientes.length === 0 ? <p className="mt-3 rounded-card bg-leaf-50 p-5 text-sm text-muted">No hay novedades pendientes.</p> : <ul className="mt-3 flex flex-col gap-3">{pendientes.map((n) => tarjeta(n, true))}</ul>}
      {resto.length > 0 && <><h2 className="mt-8 font-display text-2xl font-bold text-leaf-700">Revisadas</h2><ul className="mt-3 flex flex-col gap-3">{resto.map((n) => tarjeta(n, false))}</ul></>}
    </>
  );
}

export default function PaginaNovedades({ params, searchParams }: PageProps<"/proyectos/[id]/novedades">) {
  return <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><Contenido params={params} searchParams={searchParams} /></Suspense>;
}
