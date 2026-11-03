import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/sesion";
import { ES_UUID } from "@/lib/formato";
import { ETIQUETA_TIPO_TERCERO, esNitTemporal } from "@/lib/aliados";
import { ETAPAS } from "@/lib/contratos/vigilancia";
import { ETIQUETA_TIPO_CONTRATO } from "@/lib/obra/contratos";
import { desdeJson, formatearPesos } from "@/lib/presupuesto/dinero";
import { Titulo } from "@/components/ui";
import { numeroParametro, type FilaParametro } from "@/lib/pmo/parametros";
import { FormularioTercero } from "../formulario-tercero";
import { borrarDocumento, guardarDocumento, guardarTercero } from "../acciones";
import { FormularioDocumento } from "../formulario-documento";
import { AvisoResultado } from "@/components/aviso-resultado";
import { diasParaVencer, hoyColombia } from "@/lib/actividades";
import { BotonEnviar } from "@/components/boton-enviar";
import { formatearFecha } from "@/lib/formato";
import { Ayuda } from "@/components/ayuda";

async function Contenido({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string | string[] }> }) {
  const { id } = await params;
  const { ok } = await searchParams;
  const nuevo = id === "nuevo";
  if (!nuevo && !ES_UUID.test(id)) notFound();
  const { supabase } = await obtenerSesion();
  const { data: puedeVer } = await supabase.rpc("puede_ver_aliados");
  if (puedeVer !== true) redirect("/");
  const { data: puedeEditar } = await supabase.rpc("puede_editar_aliados");
  if (nuevo && puedeEditar !== true) redirect("/aliados");

  const iniciales: Record<string, string> = {};
  let contratos: { id: string; proyecto_id: string; tipo: string; objeto: string; valor: number | string; etapa: number; proyectos: { codigo: string | null; nombre: string } | { codigo: string | null; nombre: string }[] | null }[] = [];
  let nit = "";
  if (!nuevo) {
    const { data } = await supabase.from("terceros").select("nit, tipo_persona, razon_social, tipo_tercero, especialidad, municipio, direccion, correo_notificacion, telefono, representante_legal, estado, fuente, observaciones").eq("id", id).maybeSingle();
    if (!data) notFound();
    for (const [k, x] of Object.entries(data as Record<string, string | null>)) iniciales[k] = x ?? "";
    nit = iniciales.nit;
    const { data: cs } = await supabase.from("contratos").select("id, proyecto_id, tipo, objeto, valor, etapa, proyectos(codigo, nombre)").eq("tercero_id", id).order("creado_en");
    contratos = (cs ?? []) as unknown as typeof contratos;
  }
  const soloLectura = puedeEditar !== true;
  let alertaDias = 30;
  let documentos: { id: string; tipo: string; fecha_expedicion: string; enlace: string | null; observaciones: string | null }[] = [];
  let tipos: { nombre: string; vigencia_dias: number }[] = [];
  if (!nuevo) {
    const [{ data: ds }, { data: ts }, { data: pars }] = await Promise.all([
      supabase.from("tercero_documentos").select("id, tipo, fecha_expedicion, enlace, observaciones").eq("tercero_id", id).order("fecha_expedicion", { ascending: false }),
      supabase.from("documento_tipos").select("nombre, vigencia_dias").order("orden"),
      supabase.from("parametros").select("ambito, ambito_id, clave, valor"),
    ]);
    alertaDias = numeroParametro((pars ?? []) as FilaParametro[], "alerta_ambar_dias", {}, 30);
    documentos = (ds ?? []) as typeof documentos;
    tipos = (ts ?? []) as typeof tipos;
  }
  const hoy = hoyColombia();
  const vigencia = new Map(tipos.map((t) => [t.nombre, t.vigencia_dias]));
  const vistos = new Set<string>(); // el primero de cada tipo (el más reciente) es el vigente

  return (
    <>
      <Link href="/aliados" className="text-sm font-medium text-leaf-600 hover:underline">← Volver al maestro</Link>
      <div className="mt-4"><Titulo>{nuevo ? "Agregar tercero" : soloLectura ? "Tercero" : "Editar tercero"}</Titulo></div>
      {!nuevo && esNitTemporal(nit) && (
        <p className="mt-3 max-w-2xl rounded-card bg-amber-50 p-3 text-sm text-amber-900">Este tercero tiene un identificador temporal. Cuando llegue el RUT, reemplaza el campo «NIT o cédula» por el definitivo: los contratos se conservan.</p>
      )}
      <div className="mt-4"><AvisoResultado ok={ok} /></div>
      <div className="mt-6"><FormularioTercero accion={guardarTercero.bind(null, nuevo ? null : id)} iniciales={iniciales} soloLectura={soloLectura} /></div>

      {!nuevo && (
        <section className="mt-10" aria-labelledby="t-docs">
          <h2 id="t-docs" className="font-display text-2xl font-bold text-leaf-700">Documentos del tercero <Ayuda tema="doc_contratista" /></h2>
          <p className="mt-1 max-w-3xl text-sm text-muted">Solo enlaces a los soportes (no se guardan archivos ni cédulas). El vencimiento sale de la fecha de expedición y la vigencia del tipo de documento; cuenta el más reciente de cada tipo. Rojo: vencido; ámbar: vence pronto. Un tercero sin documentos queda en ámbar en el semáforo de sus contratos.</p>
          {documentos.length === 0 ? (
            <p className="mt-3 rounded-card bg-leaf-50 p-5 text-sm text-muted">Aún no hay documentos registrados.</p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-card border border-soil-border">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-leaf-100 text-xs uppercase tracking-wider text-leaf-800"><tr>{["Documento", "Expedición", "Vence", "Estado", ""].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-soil-border">
                  {documentos.map((dc) => {
                    const vigente = !vistos.has(dc.tipo); vistos.add(dc.tipo);
                    const dias = vigencia.has(dc.tipo) ? diasParaVencer(new Date(Date.parse(`${dc.fecha_expedicion}T00:00:00Z`) + (vigencia.get(dc.tipo) as number) * 86_400_000).toISOString().slice(0, 10), hoy) : null;
                    const venc = vigencia.has(dc.tipo) ? new Date(Date.parse(`${dc.fecha_expedicion}T00:00:00Z`) + (vigencia.get(dc.tipo) as number) * 86_400_000).toISOString().slice(0, 10) : null;
                    return (
                      <tr key={dc.id} className={vigente ? "" : "text-muted"}>
                        <td className="px-3 py-2 align-top font-medium">{dc.tipo}{dc.enlace && <a href={dc.enlace} target="_blank" rel="noopener noreferrer" className="ml-2 text-xs font-normal text-leaf-600 underline">soporte</a>}{dc.observaciones && <p className="text-xs font-normal text-muted">{dc.observaciones}</p>}</td>
                        <td className="whitespace-nowrap px-3 py-2 align-top">{formatearFecha(dc.fecha_expedicion)}</td>
                        <td className="whitespace-nowrap px-3 py-2 align-top">{venc && (vigencia.get(dc.tipo) as number) < 36500 ? formatearFecha(venc) : "Sin vencimiento"}</td>
                        <td className="px-3 py-2 align-top">{!vigente ? "Reemplazado" : dias === null || (vigencia.get(dc.tipo) as number) >= 36500 ? "Vigente" : dias < 0 ? <span className="font-medium text-danger">Vencido hace {-dias} d</span> : dias <= alertaDias ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">Vence en {dias} d</span> : "Vigente"}</td>
                        <td className="px-3 py-2 text-right align-top">{!soloLectura && <form action={borrarDocumento.bind(null, id, dc.id)}><BotonEnviar className="text-sm font-medium text-danger underline" textoEnviando="…">Borrar</BotonEnviar></form>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {!soloLectura && <div className="mt-3 rounded-card bg-leaf-50 p-5"><FormularioDocumento accion={guardarDocumento.bind(null, id)} tipos={tipos} /></div>}
        </section>
      )}

      {!nuevo && (
        <section className="mt-10" aria-labelledby="t-contratos">
          <h2 id="t-contratos" className="font-display text-2xl font-bold text-leaf-700">Contratos de este tercero</h2>
          <p className="mt-1 text-sm text-muted">Solo aparecen los de proyectos que puedes ver. Un {ETIQUETA_TIPO_TERCERO[iniciales.tipo_tercero]?.toLowerCase() ?? "tercero"} puede tener contratos en varios proyectos.</p>
          {contratos.length === 0 ? (
            <p className="mt-3 rounded-card bg-leaf-50 p-5 text-sm text-muted">Aún no tiene contratos registrados con este tercero.</p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-card border border-soil-border">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-leaf-100 text-xs uppercase tracking-wider text-leaf-800"><tr>{["Proyecto", "Contrato", "Valor (COP)", "Etapa"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-soil-border">
                  {contratos.map((c) => {
                    const pr = Array.isArray(c.proyectos) ? c.proyectos[0] : c.proyectos;
                    return (
                      <tr key={c.id}>
                        <td className="px-3 py-2">{pr?.codigo ? `${pr.codigo} · ` : ""}{pr?.nombre ?? "—"}</td>
                        <td className="px-3 py-2"><Link href={`/proyectos/${c.proyecto_id}/contratos/${c.id}`} className="font-medium text-leaf-700 hover:underline">{ETIQUETA_TIPO_CONTRATO[c.tipo] ?? c.tipo}</Link><p className="text-xs text-muted">{c.objeto.length > 70 ? `${c.objeto.slice(0, 70)}…` : c.objeto}</p></td>
                        <td className="px-3 py-2 tabular-nums">{formatearPesos(desdeJson(c.valor, 2) * 10_000n)}</td>
                        <td className="px-3 py-2">{c.etapa}. {ETAPAS[c.etapa - 1]?.nombre}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  );
}

export default function PaginaTercero({ params, searchParams }: PageProps<"/aliados/[id]">) {
  return <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><Contenido params={params} searchParams={searchParams} /></Suspense>;
}
