import { Suspense } from "react";
import Link from "next/link";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { formatearFecha } from "@/lib/formato";
import { etiquetaTipo, tamanoLegible, TIPOS_DOCUMENTO } from "@/lib/documentos";
import { Aviso, Selector, Titulo, claseBoton } from "@/components/ui";
import { AvisoResultado } from "@/components/aviso-resultado";

type Doc = { id: string; tipo: string; nombre: string; visible_interventoria: boolean; creado_en: string };
type Ver = { documento_id: string; version: number; ruta: string; nombre_archivo: string; tamano_bytes: number; fecha: string };

async function Contenido({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; tipo?: string }> }) {
  const { id } = await params;
  const { ok, tipo } = await searchParams;
  const { supabase, proyecto, permisos } = await cargarProyecto(id);
  let q = supabase.from("documentos").select("id, tipo, nombre, visible_interventoria, creado_en").eq("proyecto_id", id).order("creado_en", { ascending: false }).limit(300);
  if (tipo && TIPOS_DOCUMENTO.some(([k]) => k === tipo)) q = q.eq("tipo", tipo);
  const { data, error } = await q;
  const docs = (data ?? []) as Doc[];
  const { data: vs } = docs.length ? await supabase.from("documento_versiones").select("documento_id, version, ruta, nombre_archivo, tamano_bytes, fecha").in("documento_id", docs.map((d) => d.id)).order("version", { ascending: false }) : { data: [] };
  const versiones = (vs ?? []) as Ver[];
  const ultima = new Map<string, Ver>();
  const total = new Map<string, number>();
  for (const v of versiones) { if (!ultima.has(v.documento_id)) ultima.set(v.documento_id, v); total.set(v.documento_id, (total.get(v.documento_id) ?? 0) + 1); }
  const rutas = [...ultima.values()].map((v) => v.ruta).slice(0, 300);
  const firmadas = rutas.length ? (await supabase.storage.from("documentos").createSignedUrls(rutas, 3600)).data ?? [] : [];
  const urlDe = new Map<string, string>(firmadas.map((f) => [f.path ?? "", f.signedUrl ?? ""]));
  const puedeSubir = permisos.reportar || permisos.interventor;

  return (
    <>
      <Link href={`/proyectos/${id}`} className="text-sm font-medium text-leaf-600 hover:underline">← Volver al proyecto</Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <Titulo>Documentos</Titulo>
        {puedeSubir && <Link href={`/proyectos/${id}/documentos/nuevo`} className={claseBoton.primario}>Subir documento</Link>}
      </div>
      <p className="mt-3 text-sm text-muted">{proyecto.nombre} · archivos privados con versiones{permisos.interventor ? " · solo ves lo que el gerente te abrió y tus informes" : ""}</p>
      <div className="mt-4"><AvisoResultado ok={ok} /></div>
      <form className="mt-4 flex flex-wrap items-end gap-3" aria-label="Filtro">
        <Selector etiqueta="Tipo" name="tipo" defaultValue={tipo ?? ""}><option value="">Todos</option>{TIPOS_DOCUMENTO.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</Selector>
        <button className={claseBoton.secundario}>Filtrar</button>
      </form>
      {error && <div className="mt-4"><Aviso>No se pudieron leer los documentos{error.code ? ` (código ${error.code})` : ""}.</Aviso></div>}
      {docs.length === 0 && !error ? (
        <p className="mt-6 rounded-card bg-leaf-50 p-6 text-sm text-muted">No hay documentos{tipo ? " de ese tipo" : ""}.</p>
      ) : (
        <ul className="mt-6 divide-y divide-soil-border rounded-card border border-soil-border">
          {docs.map((d) => {
            const v = ultima.get(d.id);
            const url = v ? urlDe.get(v.ruta) : undefined;
            return (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <Link href={`/proyectos/${id}/documentos/${d.id}`} className="font-medium text-leaf-700 hover:underline">{d.nombre}</Link>
                  <p className="text-sm text-muted">{etiquetaTipo(d.tipo)} · versión {v?.version ?? "—"} de {total.get(d.id) ?? 0}{v ? ` · ${tamanoLegible(v.tamano_bytes)} · ${formatearFecha(v.fecha.slice(0, 10))}` : ""}{d.visible_interventoria && !permisos.interventor ? " · visible para interventoría" : ""}</p>
                </div>
                {url && <a href={url} target="_blank" rel="noopener noreferrer" className={claseBoton.secundario}>Descargar</a>}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

export default function PaginaDocumentos({ params, searchParams }: PageProps<"/proyectos/[id]/documentos">) {
  return <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><Contenido params={params} searchParams={searchParams} /></Suspense>;
}
