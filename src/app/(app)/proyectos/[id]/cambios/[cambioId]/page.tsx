import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { ES_UUID, formatearFecha, formatearFechaHora } from "@/lib/formato";
import { desdeJson } from "@/lib/presupuesto/dinero";
import { centavos } from "@/lib/pmo/formato";
import {
  AMBITOS_CAMBIO, diasDesde, ESTADOS_CAMBIO, ETIQUETA_APROBADOR, ETIQUETA_ESTADO_CAMBIO, ETIQUETA_NIVEL_CAMBIO,
  esEditable, quienAprueba, siguienteEstado, type EstadoCambio,
} from "@/lib/pmo/cambios";
import { valorParametro, type FilaParametro } from "@/lib/pmo/parametros";
import type { NivelCambio } from "@/lib/pmo/semaforo";
import { Aviso, Titulo, claseBoton } from "@/components/ui";
import { BotonEnviar } from "@/components/boton-enviar";
import { AvisoResultado } from "@/components/aviso-resultado";
import { avanzarCambio, decidirCambio, devolverCambio, firmarCambio } from "../acciones";

type Cambio = Record<string, unknown> & {
  id: string; codigo: string; estado_flujo: EstadoCambio; nivel: NivelCambio | null; variacion_pct: number | null; base_valor: number | string | null;
  impacto_costo: number | string; impacto_dias: number; ambitos: string[]; requiere_firma_patrocinador: boolean; firma_patrocinador: string | null;
  en_aprobacion_desde: string | null; fecha_aprobacion: string | null; riesgo_id: string | null; contrato_id: string | null;
};

function Dato({ t, v }: { t: string; v: React.ReactNode }) {
  return <div><dt className="text-xs font-medium uppercase tracking-wider text-leaf-800">{t}</dt><dd className="mt-0.5 whitespace-pre-wrap text-leaf-900">{v || "—"}</dd></div>;
}

function Nota({ nombre = "nota", obligatoria }: { nombre?: string; obligatoria?: boolean }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-leaf-800">Nota{obligatoria ? "" : " (opcional)"}</span>
      <input name={nombre} maxLength={500} required={obligatoria} className="h-[42px] w-full rounded-[10px] border border-soil-border bg-white px-3.5 text-[15px] focus:border-leaf-500 focus:outline-none focus:ring-[3px] focus:ring-leaf-500/30" />
    </label>
  );
}

async function Contenido({ params, searchParams }: { params: Promise<{ id: string; cambioId: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { id, cambioId } = await params;
  const { ok, error: errorFlujo } = await searchParams;
  if (!ES_UUID.test(cambioId)) notFound();
  const { supabase, proyecto, permisos } = await cargarProyecto(id);
  const { data } = await supabase.from("cambios").select("*").eq("id", cambioId).eq("proyecto_id", id).maybeSingle();
  if (!data) notFound();
  const c = data as Cambio;

  const [{ data: historial }, { data: bases }, { data: pars }, { data: perfiles }, riesgo] = await Promise.all([
    supabase.from("cambios_historial").select("id, fecha, usuario_id, de_estado, a_estado, nota").eq("cambio_id", cambioId).order("id"),
    supabase.from("lineas_base").select("tipo, version, bac, fecha_fin").eq("cambio_id", cambioId),
    supabase.from("parametros").select("ambito, ambito_id, clave, valor"),
    supabase.from("perfiles").select("id, nombre"),
    c.riesgo_id ? supabase.from("riesgos").select("codigo, descripcion").eq("id", c.riesgo_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const parametros = (pars ?? []) as FilaParametro[];
  const nombres = new Map(((perfiles ?? []) as { id: string; nombre: string }[]).map((p) => [p.id, p.nombre]));
  const ctxP = { proyectoId: id, portafolioId: proyecto.portafolio_id };

  const e = c.estado_flujo;
  const sig = siguienteEstado(e);
  const aprobador = c.nivel ? quienAprueba(c.nivel, parametros, ctxP) : null;
  const adminPuede = valorParametro(parametros, "cambio_admin_puede_aprobar", ctxP) === "si";
  const puedeDecidir = e === "aprobacion" && aprobador !== null && ((aprobador === "gerente" && permisos.gerente) || (aprobador === "director_general" && permisos.director) || (permisos.admin && adminPuede));
  const puedeAvanzar = sig && e !== "aprobacion" && (["identificado", "aprobado", "implementacion", "rechazado"].includes(e) ? permisos.gestionar : permisos.reportar);
  const puedeEditar = e !== "cerrado" && (permisos.gestionar || (esEditable(e) && permisos.reportar));
  const puedeFirmar = e === "aprobacion" && c.requiere_firma_patrocinador && !c.firma_patrocinador && (permisos.patrocinador || permisos.admin);
  const espera = e === "aprobacion" ? diasDesde(c.en_aprobacion_desde) : null;
  const costo = desdeJson(c.impacto_costo, 2);
  const base = `/proyectos/${id}/cambios/${cambioId}`;

  return (
    <>
      <Link href={`/proyectos/${id}/cambios`} className="text-sm font-medium text-leaf-600 hover:underline">← Volver a los cambios</Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div><Titulo>{c.codigo}</Titulo><p className="mt-2 text-sm text-muted">{proyecto.nombre} · {c.tipo as string} · {formatearFecha(c.fecha_solicitud as string)}</p></div>
        {puedeEditar && <Link href={`${base}/editar`} className={claseBoton.contorno}>Editar</Link>}
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <AvisoResultado ok={ok} />
        {errorFlujo && <Aviso>{errorFlujo.slice(0, 400)}</Aviso>}
      </div>

      <ol className="mt-6 flex flex-wrap gap-2 text-xs" aria-label="Fases del cambio">
        {ESTADOS_CAMBIO.filter((x) => !(x === "rechazado" && e !== "rechazado")).map((x) => (
          <li key={x} aria-current={x === e ? "step" : undefined} className={`rounded-full border px-3 py-1 ${x === e ? "border-leaf-600 bg-leaf-600 font-medium text-white" : "border-soil-border text-muted"}`}>{ETIQUETA_ESTADO_CAMBIO[x]}</li>
        ))}
      </ol>

      <section className="mt-6 grid gap-3 sm:grid-cols-4" aria-label="Nivel del cambio">
        <div className="rounded-card bg-leaf-100 p-4"><p className="text-xs font-medium uppercase tracking-wider text-leaf-800">Nivel</p><p className="mt-1 font-display text-xl font-bold [overflow-wrap:anywhere] sm:text-2xl text-leaf-700">{c.nivel ? ETIQUETA_NIVEL_CAMBIO[c.nivel] : "Sin calcular"}</p></div>
        <div className="rounded-card bg-leaf-100 p-4"><p className="text-xs font-medium uppercase tracking-wider text-leaf-800">Variación</p><p className="mt-1 font-display text-xl font-bold [overflow-wrap:anywhere] sm:text-2xl text-leaf-700">{c.variacion_pct === null ? "—" : `${Number(c.variacion_pct).toLocaleString("es-CO", { maximumFractionDigits: 2 })} %`}</p><p className="text-xs text-muted">sobre {c.base_valor === null ? "—" : `${centavos(desdeJson(c.base_valor, 2))} COP`}</p></div>
        <div className="rounded-card bg-leaf-100 p-4"><p className="text-xs font-medium uppercase tracking-wider text-leaf-800">Lo decide</p><p className="mt-1 text-sm font-medium text-leaf-900">{aprobador ? ETIQUETA_APROBADOR[aprobador] : "—"}</p></div>
        <div className="rounded-card bg-leaf-100 p-4"><p className="text-xs font-medium uppercase tracking-wider text-leaf-800">Firma del patrocinador</p><p className="mt-1 text-sm font-medium text-leaf-900">{c.requiere_firma_patrocinador ? (c.firma_patrocinador ? `Firmada el ${formatearFecha(c.firma_patrocinador)}` : "Requerida, pendiente") : "No requerida"}</p></div>
      </section>
      {!c.nivel && <div className="mt-3"><Aviso>No hay línea base de costo (BAC) para calcular el nivel. Registra una medición de valor ganado y vuelve a guardar el cambio.</Aviso></div>}

      <dl className="mt-6 grid gap-4 rounded-card border border-soil-border p-5 sm:grid-cols-2">
        <Dato t="Cómo está hoy" v={c.descripcion_antes as string} />
        <Dato t="Cómo quedaría" v={c.descripcion_despues as string} />
        <Dato t="Justificación" v={c.justificacion as string} />
        <Dato t="Impacto en el alcance" v={c.impacto_alcance as string} />
        <Dato t="Impacto en costo (COP)" v={centavos(costo)} />
        <Dato t="Impacto en tiempo" v={`${c.impacto_dias} día(s)`} />
        <Dato t="Ámbitos afectados" v={c.ambitos.length ? c.ambitos.map((a) => AMBITOS_CAMBIO.find(([k]) => k === a)?.[1] ?? a).join(", ") : ""} />
        <Dato t="Riesgo de origen" v={riesgo.data ? `${(riesgo.data as { codigo: string }).codigo} · ${(riesgo.data as { descripcion: string }).descripcion.slice(0, 80)}` : ""} />
        <Dato t="Solicitante" v={nombres.get(c.solicitante_id as string)} />
        <Dato t="Aprobador" v={c.aprobador_id ? `${nombres.get(c.aprobador_id as string) ?? "—"} (${c.fecha_aprobacion ? formatearFecha(c.fecha_aprobacion) : ""})` : ""} />
        <Dato t="Responsable de implementación" v={c.responsable_implementacion as string} />
        <Dato t="Observaciones" v={c.observaciones as string} />
        <Dato t="Lecciones aprendidas" v={c.lecciones as string} />
        {Boolean(c.detectado_sin_formato) && <Dato t="Origen" v="Detectado sin formato (cambio ya ejecutado)" />}
      </dl>

      {((bases ?? []) as { tipo: string; version: number; bac: number | string | null; fecha_fin: string | null }[]).length > 0 && (
        <section className="mt-6" aria-label="Líneas base generadas">
          <h2 className="font-display text-xl font-bold text-leaf-700">Líneas base generadas por este cambio</h2>
          <ul className="mt-2 text-sm">
            {((bases ?? []) as { tipo: string; version: number; bac: number | string | null; fecha_fin: string | null }[]).map((b) => (
              <li key={`${b.tipo}${b.version}`}>Línea base de {b.tipo} v{b.version}{b.bac !== null ? ` · BAC ${centavos(desdeJson(b.bac, 2))} COP` : ""}{b.fecha_fin ? ` · fin ${formatearFecha(b.fecha_fin)}` : ""}</li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-muted">Recuerda reflejar el cambio aprobado en el presupuesto del proyecto.</p>
        </section>
      )}

      {(puedeAvanzar || e === "aprobacion") && (
        <section className="mt-8 rounded-card bg-leaf-50 p-5" aria-label="Acciones">
          <h2 className="mb-3 font-display text-xl font-bold text-leaf-700">Siguiente paso</h2>
          {espera !== null && <p className="mb-3 text-sm text-muted">Lleva {espera} día(s) esperando decisión.</p>}
          {puedeAvanzar && sig && (
            <form action={avanzarCambio.bind(null, id, cambioId)} className="flex max-w-xl flex-col gap-3">
              <Nota />
              <div><BotonEnviar className={claseBoton.primario} textoEnviando="Procesando…">{e === "implementacion" || e === "rechazado" ? "Cerrar el cambio" : `Pasar a: ${ETIQUETA_ESTADO_CAMBIO[sig]}`}</BotonEnviar></div>
            </form>
          )}
          {e === "aprobacion" && (
            <div className="flex flex-col gap-6">
              {puedeFirmar && (
                <form action={firmarCambio.bind(null, id, cambioId)}><BotonEnviar className={claseBoton.secundario} textoEnviando="Firmando…">Registrar la firma del patrocinador</BotonEnviar></form>
              )}
              {puedeDecidir ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <form action={decidirCambio.bind(null, id, cambioId, "aprobar")} className="flex flex-col gap-3"><Nota /><div><BotonEnviar className={claseBoton.primario} textoEnviando="Aprobando…">Aprobar</BotonEnviar></div></form>
                  <form action={decidirCambio.bind(null, id, cambioId, "rechazar")} className="flex flex-col gap-3"><Nota obligatoria /><div><BotonEnviar className={claseBoton.peligro} textoEnviando="Rechazando…">Rechazar</BotonEnviar></div></form>
                </div>
              ) : (
                <p className="text-sm text-muted">La decisión es de {aprobador ? ETIQUETA_APROBADOR[aprobador] : "quien corresponda"}.</p>
              )}
              {permisos.reportar && (
                <form action={devolverCambio.bind(null, id, cambioId)} className="flex max-w-xl flex-col gap-3"><Nota obligatoria /><div><BotonEnviar className={claseBoton.contorno} textoEnviando="Devolviendo…">Devolver a análisis de impacto</BotonEnviar></div></form>
              )}
            </div>
          )}
        </section>
      )}

      <section className="mt-8" aria-label="Historial">
        <h2 className="font-display text-xl font-bold text-leaf-700">Historial</h2>
        <ul className="mt-2 divide-y divide-soil-border rounded-card border border-soil-border text-sm">
          {((historial ?? []) as { id: number; fecha: string; usuario_id: string | null; de_estado: string | null; a_estado: string; nota: string | null }[]).map((h) => (
            <li key={h.id} className="p-3">
              <span className="font-medium">{ETIQUETA_ESTADO_CAMBIO[h.a_estado as EstadoCambio] ?? h.a_estado}</span>
              <span className="text-muted"> · {formatearFechaHora(h.fecha)} · {(h.usuario_id && nombres.get(h.usuario_id)) || "—"}</span>
              {h.nota && <p className="text-muted">{h.nota}</p>}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

export default function PaginaCambio({ params, searchParams }: PageProps<"/proyectos/[id]/cambios/[cambioId]">) {
  return <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><Contenido params={params} searchParams={searchParams} /></Suspense>;
}
