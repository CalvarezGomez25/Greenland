import { Suspense } from "react";
import Link from "next/link";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { formatearFecha } from "@/lib/formato";
import { ESTADOS_HALLAZGO, SEVERIDADES, etiqueta } from "@/lib/interventoria";
import { Aviso, Titulo, claseBoton } from "@/components/ui";
import { BotonEnviar } from "@/components/boton-enviar";
import { AvisoResultado } from "@/components/aviso-resultado";
import { FormularioRegistro } from "../../r/formulario-registro";
import { cargarOpciones } from "../datos";
import { cerrarHallazgo, crearHallazgo, reabrirHallazgo, responderHallazgo } from "../acciones";
import type { CampoDef } from "@/lib/registros/tipos";

type H = { id: string; contrato_id: string | null; severidad: string; descripcion: string; evidencia: string[]; fecha: string; plazo_respuesta: string; estado: string; respuesta: string | null };

const COLOR: Record<string, string> = { abierto: "bg-amber-100 text-amber-900", respondido: "bg-leaf-100 text-leaf-800", cerrado: "bg-white text-muted border border-soil-border", escalado: "bg-red-100 text-red-900" };

async function Contenido({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { id } = await params;
  const { ok, error: errorUrl } = await searchParams;
  const { supabase, proyecto, permisos } = await cargarProyecto(id);
  await supabase.rpc("hallazgos_escalar", { p_proyecto: id }); // los plazos vencidos pasan a Escalado
  const [o, { data, error }] = await Promise.all([
    cargarOpciones(supabase, id, proyecto.portafolio_id),
    supabase.from("hallazgos").select("id, contrato_id, severidad, descripcion, evidencia, fecha, plazo_respuesta, estado, respuesta").eq("proyecto_id", id).order("fecha", { ascending: false }).limit(300),
  ]);
  const hallazgos = (data ?? []) as H[];
  const nomContrato = new Map(o.todosContratos.map((c) => [c.valor, c.etiqueta]));
  const nomDoc = new Map(o.documentos.map((d) => [d.valor, d.etiqueta]));
  const campos: CampoDef[] = [
    { nombre: "contrato_id", etiqueta: "Contrato", tipo: "seleccion", opcionesDe: "contratos", ayuda: "Opcional si el hallazgo no es de un contrato." },
    { nombre: "severidad", etiqueta: "Severidad", tipo: "seleccion", obligatorio: true, opciones: SEVERIDADES.map(([valor, etiqueta]) => ({ valor, etiqueta })), ayuda: "El plazo de respuesta (en días hábiles de Colombia) depende de la severidad." },
    { nombre: "descripcion", etiqueta: "Descripción del hallazgo", tipo: "area", obligatorio: true },
    { nombre: "evidencia", etiqueta: "Documento de evidencia", tipo: "seleccion", opcionesDe: "documentos", ayuda: "Sube antes la evidencia en Documentos (como informe) y elígela aquí." },
  ];

  return (
    <>
      <Link href={`/proyectos/${id}/interventoria`} className="text-sm font-medium text-leaf-600 hover:underline">← Interventoría</Link>
      <div className="mt-4"><Titulo>Hallazgos y requerimientos</Titulo></div>
      <p className="mt-3 max-w-3xl text-sm text-muted">Observación: 5 días hábiles · No conformidad: 3 · Incumplimiento grave: 1 (configurable en Parámetros). Si el plazo vence sin respuesta, el hallazgo pasa a Escalado y aparece en el dashboard.</p>
      <div className="mt-4 flex flex-col gap-2"><AvisoResultado ok={ok} />{errorUrl && <Aviso>{errorUrl.slice(0, 400)}</Aviso>}</div>
      {error && <div className="mt-4"><Aviso>No se pudieron leer los hallazgos{error.code ? ` (código ${error.code})` : ""}.</Aviso></div>}
      {hallazgos.length === 0 && !error ? <p className="mt-6 rounded-card bg-leaf-50 p-6 text-sm text-muted">No hay hallazgos.</p> : (
        <ul className="mt-6 flex flex-col gap-4">
          {hallazgos.map((h) => (
            <li key={h.id} className="rounded-card border border-soil-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-leaf-900">{etiqueta(SEVERIDADES, h.severidad)}{h.contrato_id ? ` · ${nomContrato.get(h.contrato_id) ?? "contrato"}` : ""}</p>
                <span className={`rounded-full px-3 py-0.5 text-xs font-medium ${COLOR[h.estado]}`}>{etiqueta(ESTADOS_HALLAZGO, h.estado)}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm">{h.descripcion}</p>
              <p className="mt-1 text-xs text-muted">Registrado el {formatearFecha(h.fecha)} · plazo de respuesta: {formatearFecha(h.plazo_respuesta)}{h.evidencia.length ? ` · evidencia: ${h.evidencia.map((e) => nomDoc.get(e) ?? "documento").join(", ")}` : ""}</p>
              {h.respuesta && <p className="mt-2 whitespace-pre-wrap rounded-[10px] bg-leaf-50 p-3 text-sm"><strong>Respuesta:</strong> {h.respuesta}</p>}
              <div className="mt-3 flex flex-wrap items-start gap-4">
                {permisos.gestionar && h.estado !== "cerrado" && (
                  <form action={responderHallazgo.bind(null, id, h.id)} className="flex flex-1 flex-wrap items-end gap-2">
                    <label className="flex min-w-[240px] flex-1 flex-col gap-1.5"><span className="text-[13px] font-medium text-leaf-800">Respuesta del contratista o del gerente</span><input name="respuesta" required maxLength={4000} className="h-[42px] w-full rounded-[10px] border border-soil-border bg-white px-3.5 text-[15px]" /></label>
                    <BotonEnviar className={claseBoton.secundario} textoEnviando="Guardando…">Responder</BotonEnviar>
                  </form>
                )}
                {permisos.interventor && h.estado === "respondido" && <form action={cerrarHallazgo.bind(null, id, h.id)}><BotonEnviar className={claseBoton.primario} textoEnviando="Cerrando…">Cerrar hallazgo</BotonEnviar></form>}
                {permisos.interventor && (h.estado === "respondido" || h.estado === "cerrado") && <form action={reabrirHallazgo.bind(null, id, h.id)}><BotonEnviar className={claseBoton.contorno} textoEnviando="Reabriendo…">Reabrir (respuesta insuficiente)</BotonEnviar></form>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {permisos.interventor && (
        <section className="mt-8 rounded-card bg-leaf-50 p-5"><h2 className="mb-3 font-display text-xl font-bold text-leaf-700">Registrar un hallazgo</h2>
          <FormularioRegistro accion={crearHallazgo.bind(null, id)} campos={campos} opciones={{ contratos: o.contratosObra, documentos: o.documentos }} iniciales={{}} editando={false} volverA={`/proyectos/${id}/interventoria`} /></section>
      )}
    </>
  );
}

export default function PaginaHallazgos({ params, searchParams }: PageProps<"/proyectos/[id]/interventoria/hallazgos">) {
  return <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><Contenido params={params} searchParams={searchParams} /></Suspense>;
}
