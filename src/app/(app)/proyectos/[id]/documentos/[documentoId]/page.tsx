import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { ES_UUID, formatearFechaHora } from "@/lib/formato";
import { etiquetaTipo, tamanoLegible } from "@/lib/documentos";
import { Aviso, Titulo, claseBoton } from "@/components/ui";
import { BotonEnviar } from "@/components/boton-enviar";
import { AvisoResultado } from "@/components/aviso-resultado";
import { cambiarVisibilidad, prepararSubidaDocumento, registrarDocumento } from "../acciones";
import { FormularioDocumento } from "../formulario-documento";

type Ver = { id: string; version: number; ruta: string; nombre_archivo: string; tamano_bytes: number; nota: string | null; subido_por: string | null; fecha: string };

async function Contenido({ params, searchParams }: { params: Promise<{ id: string; documentoId: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { id, documentoId } = await params;
  const { ok, error: errorUrl } = await searchParams;
  if (!ES_UUID.test(documentoId)) notFound();
  const { supabase, permisos } = await cargarProyecto(id);
  const { data: d } = await supabase.from("documentos").select("id, tipo, nombre, visible_interventoria, entidad_tipo, entidad_id, creado_en").eq("id", documentoId).eq("proyecto_id", id).maybeSingle();
  if (!d) notFound();
  const [{ data: vs }, { data: perfiles }] = await Promise.all([
    supabase.from("documento_versiones").select("id, version, ruta, nombre_archivo, tamano_bytes, nota, subido_por, fecha").eq("documento_id", documentoId).order("version", { ascending: false }),
    supabase.from("perfiles").select("id, nombre"),
  ]);
  const versiones = (vs ?? []) as Ver[];
  const nombres = new Map(((perfiles ?? []) as { id: string; nombre: string }[]).map((p) => [p.id, p.nombre]));
  const firmadas = versiones.length ? (await supabase.storage.from("documentos").createSignedUrls(versiones.map((v) => v.ruta), 3600)).data ?? [] : [];
  const urlDe = new Map<string, string>(firmadas.map((f) => [f.path ?? "", f.signedUrl ?? ""]));
  const puedeVersionar = permisos.reportar || (permisos.interventor && d.tipo === "informe");

  return (
    <>
      <Link href={`/proyectos/${id}/documentos`} className="text-sm font-medium text-leaf-600 hover:underline">← Volver a los documentos</Link>
      <div className="mt-4"><Titulo>{d.nombre}</Titulo></div>
      <p className="mt-2 text-sm text-muted">{etiquetaTipo(d.tipo)}{d.entidad_tipo ? ` · vinculado a ${d.entidad_tipo}` : ""}</p>
      <div className="mt-4 flex flex-col gap-2"><AvisoResultado ok={ok} />{errorUrl && <Aviso>{errorUrl.slice(0, 400)}</Aviso>}</div>

      <section className="mt-6" aria-label="Versiones">
        <h2 className="font-display text-xl font-bold text-leaf-700">Versiones</h2>
        <ul className="mt-2 divide-y divide-soil-border rounded-card border border-soil-border">
          {versiones.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
              <div>
                <p className="font-medium">Versión {v.version} · {v.nombre_archivo}</p>
                <p className="text-muted">{tamanoLegible(v.tamano_bytes)} · {formatearFechaHora(v.fecha)} · {(v.subido_por && nombres.get(v.subido_por)) || "—"}{v.nota ? ` · ${v.nota}` : ""}</p>
              </div>
              {urlDe.get(v.ruta) && <a href={urlDe.get(v.ruta) as string} target="_blank" rel="noopener noreferrer" className={claseBoton.secundario}>Descargar</a>}
            </li>
          ))}
        </ul>
      </section>

      {permisos.gestionar && (
        <section className="mt-6 rounded-card bg-leaf-50 p-5" aria-label="Interventoría">
          <p className="mb-3 text-sm">{d.visible_interventoria ? "La interventoría puede ver este documento." : "La interventoría no ve este documento."}</p>
          <form action={cambiarVisibilidad.bind(null, id, documentoId, !d.visible_interventoria)}><BotonEnviar className={claseBoton.secundario} textoEnviando="Guardando…">{d.visible_interventoria ? "Ocultar a la interventoría" : "Abrir a la interventoría"}</BotonEnviar></form>
        </section>
      )}

      {puedeVersionar && (
        <section className="mt-8" aria-label="Nueva versión">
          <h2 className="mb-3 font-display text-xl font-bold text-leaf-700">Subir una nueva versión</h2>
          <FormularioDocumento proyectoId={id} documentoId={documentoId} nombreDocumento={d.nombre} preparar={prepararSubidaDocumento} registrar={registrarDocumento} volverA={`/proyectos/${id}/documentos/${documentoId}`} />
        </section>
      )}
    </>
  );
}

export default function PaginaDocumento({ params, searchParams }: PageProps<"/proyectos/[id]/documentos/[documentoId]">) {
  return <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><Contenido params={params} searchParams={searchParams} /></Suspense>;
}
