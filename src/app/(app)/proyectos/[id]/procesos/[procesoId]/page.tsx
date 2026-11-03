import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { ES_UUID, formatearFecha } from "@/lib/formato";
import { hoyColombia } from "@/lib/actividades";
import { aEscalado, desdeJson, formatearDecimal, formatearPesos } from "@/lib/presupuesto/dinero";
import { numeroParametro, type FilaParametro } from "@/lib/pmo/parametros";
import { formatearNit } from "@/lib/aliados";
import { parametrosDeVigilancia, topeAsamblea } from "@/lib/contratos/vigilancia";
import { CRITERIOS, ETIQUETA_ESTADO_OFERTA, ETIQUETA_ESTADO_PROCESO, ETIQUETA_TIPO_SERVICIO, calcularOfertas, pesosDeOfertas, semaforoProceso, type EstadoOferta, type EstadoProceso } from "@/lib/contratos/ofertas";
import { Aviso, Titulo, claseBoton } from "@/components/ui";
import { AvisoResultado } from "@/components/aviso-resultado";
import { BotonEnviar } from "@/components/boton-enviar";
import { adjudicarOferta, borrarOferta, borrarProceso, guardarOferta, guardarProceso } from "../acciones";
import { FormularioOferta, FormularioProceso } from "../formularios";

const PUNTO = { rojo: "bg-red-600", ambar: "bg-amber-500", verde: "bg-leaf-500" } as const;
const ETIQ = { rojo: "Rojo", ambar: "Ámbar", verde: "Verde" } as const;
const pct = (n: number | null) => (n === null ? "—" : `${n > 0 ? "+" : ""}${(n * 100).toLocaleString("es-CO", { maximumFractionDigits: 1 })} %`);
const num1 = (n: number | null) => (n === null ? "—" : n.toLocaleString("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));

async function Contenido({ params, searchParams }: { params: Promise<{ id: string; procesoId: string }>; searchParams: Promise<{ ok?: string; error?: string; oferta?: string }> }) {
  const { id, procesoId } = await params;
  const { ok, error: errorUrl, oferta: ofertaEditar } = await searchParams;
  if (!ES_UUID.test(procesoId)) notFound();
  const { supabase, proyecto, permisos } = await cargarProyecto(id);
  if (permisos.interventor) redirect(`/proyectos/${id}`);
  const { data: p } = await supabase.from("procesos").select("*").eq("id", procesoId).eq("proyecto_id", id).maybeSingle();
  if (!p) notFound();
  const [{ data: os }, { data: pars }, { data: ts }] = await Promise.all([
    supabase.from("ofertas").select("*").eq("proceso_id", procesoId).order("ronda").order("codigo"),
    supabase.from("parametros").select("ambito, ambito_id, clave, valor"),
    supabase.from("terceros").select("id, nit, razon_social").eq("estado", "activo").order("razon_social").limit(1000),
  ]);
  type O = { id: string; codigo: string; oferente: string; ronda: number; estado: EstadoOferta; habilitada: "si" | "no" | null; fecha_recepcion: string | null; valor_total: number | string | null; aiu_pct: number | string | null; plazo_dias: number | null; anticipo_pct: number | string | null; vigencia_hasta: string | null; incluye_polizas: boolean | null; apu_discriminado: boolean | null; crit_experiencia: number | null; crit_capacidad: number | null; crit_programacion: number | null; crit_comercial: number | null; crit_sst: number | null; enlace: string | null; observaciones: string | null };
  const ofertas = (os ?? []) as O[];
  const filas = (pars ?? []) as FilaParametro[];
  const hoy = hoyColombia();
  const pesos = pesosDeOfertas(filas, id), vig = parametrosDeVigilancia(filas, id), tope = topeAsamblea(vig);
  const ppto = p.presupuesto_referencia === null ? null : desdeJson(p.presupuesto_referencia, 2);
  const calc = calcularOfertas(ofertas.map((o) => ({ id: o.id, ronda: o.ronda, estado: o.estado, habilitada: o.habilitada, valor: o.valor_total === null ? null : desdeJson(o.valor_total, 2), criterios: [o.crit_experiencia, o.crit_capacidad, o.crit_programacion, o.crit_comercial, o.crit_sst], vigenciaHasta: o.vigencia_hasta })), ppto, pesos, hoy, vig.alertaDias);
  const sem = semaforoProceso({ estado: p.estado as EstadoProceso, cierre: p.cierre_propuestas, contratoId: p.contrato_id }, hoy, numeroParametro(filas, "proceso_eval_dias", { proyectoId: id }, 15));
  const rondas = [...new Set(ofertas.map((o) => o.ronda))].sort((a, b) => a - b);
  const enEdicion = ofertaEditar && ES_UUID.test(ofertaEditar) ? ofertas.find((o) => o.id === ofertaEditar) : undefined;
  const base = `/proyectos/${id}/procesos/${procesoId}`;
  const abierto = p.estado === "abierta" || p.estado === "en_evaluacion";
  const oferentes = ((ts ?? []) as { id: string; nit: string; razon_social: string }[]).map((t) => ({ id: t.id, etiqueta: `${t.razon_social} (${formatearNit(t.nit)})` }));
  const f = (x: number | string | null) => (x === null ? "" : formatearDecimal(aEscalado(String(x), 2), 2));
  const inicialesProceso: Record<string, string> = { objeto: p.objeto, tipo_servicio: p.tipo_servicio, modalidad: p.modalidad ?? "", gestor: p.gestor ?? "", fecha_invitacion: p.fecha_invitacion ?? "", cierre_propuestas: p.cierre_propuestas ?? "", presupuesto_referencia: f(p.presupuesto_referencia), estado: p.estado, enlace: p.enlace ?? "", observaciones: p.observaciones ?? "" };

  return (
    <>
      <Link href={`/proyectos/${id}/procesos`} className="text-sm font-medium text-leaf-600 hover:underline">← Volver a los procesos</Link>
      <div className="mt-4"><Titulo>{p.codigo} · {ETIQUETA_TIPO_SERVICIO[p.tipo_servicio]}</Titulo></div>
      <p className="mt-3 max-w-3xl text-sm">{p.objeto}</p>
      <div className="mt-4 flex flex-col gap-2"><AvisoResultado ok={ok} />{errorUrl && <Aviso>{errorUrl.slice(0, 400)}</Aviso>}</div>

      <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Resumen del proceso">
        {([["Estado", ETIQUETA_ESTADO_PROCESO[p.estado as EstadoProceso]], ["Cierre de propuestas", p.cierre_propuestas ? formatearFecha(p.cierre_propuestas) : "—"], ["Presupuesto de referencia", ppto === null ? "—" : formatearPesos(ppto * 10_000n)], ["Alerta", sem.nivel ? `${ETIQ[sem.nivel]}${sem.alerta ? `: ${sem.alerta}` : ""}` : "—"]] as [string, string][]).map(([t, v]) => (
          <div key={t} className="rounded-card bg-leaf-100 p-4"><p className="text-xs font-medium uppercase tracking-wider text-leaf-800">{t}</p><p className="mt-1 font-display text-lg font-bold text-leaf-700">{t === "Alerta" && sem.nivel ? <span className="inline-flex items-center gap-1.5"><span aria-hidden className={`h-2.5 w-2.5 rounded-full ${PUNTO[sem.nivel]}`} />{v}</span> : v}</p></div>
        ))}
      </section>
      {p.enlace && <p className="mt-2 text-sm"><a href={p.enlace} target="_blank" rel="noopener noreferrer" className="font-medium text-leaf-600 underline">Carpeta del proceso</a></p>}

      {p.estado === "adjudicada" && (
        <div className="mt-4 rounded-card border border-soil-border bg-leaf-50 p-4 text-sm">
          {p.contrato_id ? <p><strong>Contrato registrado.</strong> <Link href={`/proyectos/${id}/contratos/${p.contrato_id}`} className="font-medium text-leaf-700 underline">Ver el contrato</Link></p> : (
            <div className="flex flex-wrap items-center justify-between gap-3"><p><strong>Adjudicado sin contrato.</strong> Registra el contrato con los datos de la oferta ganadora.</p>{permisos.gestionar && <Link href={`/proyectos/${id}/contratos/nuevo?proceso=${procesoId}`} className={claseBoton.primario}>Registrar contrato de esta adjudicación</Link>}</div>
          )}
        </div>
      )}

      <section className="mt-8" aria-labelledby="t-comp">
        <h2 id="t-comp" className="font-display text-2xl font-bold text-leaf-700">Comparativo de ofertas</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted">Puntaje de precio = 100 × menor valor de la ronda ÷ valor de la oferta. Cualitativo = promedio de los cinco criterios (1 a 5) llevado a 100. Total = precio × {Math.round(pesos.precio * 100)} % + cualitativo × {Math.round((1 - pesos.precio) * 100)} %; una oferta no habilitada no recibe total. Los pesos son parámetros. Cada ronda se compara por separado. Una oferta por encima de {tope ? formatearPesos(tope * 10_000n) : "—"} necesita autorización de asamblea.</p>
        {ofertas.length === 0 ? <p className="mt-3 rounded-card bg-leaf-50 p-5 text-sm text-muted">Aún no hay ofertas. Registra a los invitados con el formulario de abajo.</p> : rondas.map((r) => (
          <div key={r} className="mt-4">
            <h3 className="mb-2 font-display text-lg font-bold text-leaf-700">Ronda {r}</h3>
            <div className="overflow-x-auto rounded-card border border-soil-border">
              <table className="w-full min-w-[1000px] text-left text-sm">
                <thead className="bg-leaf-100 text-xs uppercase tracking-wider text-leaf-800"><tr>{["Orden", "Oferente", "Estado", "Valor", "Vs. menor", "Vs. presupuesto", "Plazo", "Precio", "Cualitativo", "Total", "Vigencia", ""].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-soil-border">
                  {ofertas.filter((o) => o.ronda === r).sort((a, b) => ((calc.get(a.id)?.orden ?? 99) - (calc.get(b.id)?.orden ?? 99))).map((o) => {
                    const c = calc.get(o.id)!;
                    const supera = tope !== null && o.valor_total !== null && desdeJson(o.valor_total, 2) > tope;
                    return (
                      <tr key={o.id} className={o.estado === "adjudicada" ? "bg-leaf-50" : o.estado === "descartada" ? "text-muted" : ""}>
                        <td className="px-3 py-2 align-top tabular-nums">{c.orden ?? "—"}</td>
                        <td className="px-3 py-2 align-top font-medium">{o.oferente}<p className="text-xs font-normal text-muted">{o.codigo}{o.habilitada === "no" ? " · No habilitada" : o.habilitada === "si" ? " · Habilitada" : ""}</p>{o.enlace && <a href={o.enlace} target="_blank" rel="noopener noreferrer" className="text-xs font-normal text-leaf-600 underline">propuesta</a>}</td>
                        <td className="px-3 py-2 align-top">{ETIQUETA_ESTADO_OFERTA[o.estado]}</td>
                        <td className="px-3 py-2 align-top tabular-nums">{o.valor_total === null ? "—" : formatearPesos(desdeJson(o.valor_total, 2) * 10_000n)}{supera && <p className="text-xs text-amber-900">Supera el tope de asamblea</p>}</td>
                        <td className="px-3 py-2 align-top tabular-nums">{pct(c.difMenor)}</td>
                        <td className="px-3 py-2 align-top tabular-nums">{pct(c.difPresupuesto)}</td>
                        <td className="px-3 py-2 align-top tabular-nums">{o.plazo_dias ? `${o.plazo_dias} d` : "—"}</td>
                        <td className="px-3 py-2 align-top tabular-nums">{num1(c.precio)}</td>
                        <td className="px-3 py-2 align-top tabular-nums">{num1(c.cualitativo)}</td>
                        <td className="px-3 py-2 align-top font-bold tabular-nums">{num1(c.total)}</td>
                        <td className="px-3 py-2 align-top text-xs">{o.vigencia_hasta ? formatearFecha(o.vigencia_hasta) : "—"}{c.vigencia && <span className="mt-0.5 flex items-center gap-1"><span aria-hidden className={`h-2 w-2 rounded-full ${PUNTO[c.vigencia]}`} />{ETIQ[c.vigencia]}</span>}</td>
                        <td className="px-3 py-2 text-right align-top">
                          {permisos.gestionar && (
                            <div className="flex flex-wrap justify-end gap-3">
                              {abierto && (o.estado === "recibida" || o.estado === "en_aclaracion") && o.habilitada === "si" && <form action={adjudicarOferta.bind(null, id, procesoId, o.id)}><BotonEnviar className="text-sm font-medium text-leaf-600 underline" textoEnviando="…">Adjudicar</BotonEnviar></form>}
                              <Link href={`${base}?oferta=${o.id}#t-of`} className="text-sm font-medium text-leaf-600 underline">Editar</Link>
                              {o.estado !== "adjudicada" && <form action={borrarOferta.bind(null, id, procesoId, o.id)}><BotonEnviar className="text-sm font-medium text-danger underline" textoEnviando="…">Borrar</BotonEnviar></form>}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        <details className="mt-3 text-sm text-muted"><summary className="cursor-pointer font-medium text-leaf-700">Cómo se califica</summary>
          <p className="mt-1">Criterios y pesos dentro del cualitativo: {CRITERIOS.map((c, i) => `${c.etiqueta} ${Math.round(pesos.criterios[i] * 100)}`).join("; ")} (puntos sobre {Math.round(pesos.criterios.reduce((a, b) => a + b, 0) * 100)}). Se editan en Parámetros.</p>
        </details>
      </section>

      {permisos.gestionar && (
        <section className="mt-8" aria-labelledby="t-of">
          <h2 id="t-of" className="font-display text-2xl font-bold text-leaf-700">{enEdicion ? `Editar la oferta ${enEdicion.codigo}` : "Registrar una oferta"}</h2>
          <div className="mt-3 rounded-card bg-leaf-50 p-5">
            <FormularioOferta key={enEdicion?.id ?? "nueva"} accion={guardarOferta.bind(null, id, procesoId, enEdicion?.id ?? null)} oferentes={oferentes} edicion={!!enEdicion} volverA={base}
              iniciales={enEdicion ? { oferente: enEdicion.oferente, ronda: String(enEdicion.ronda), estado: enEdicion.estado, habilitada: enEdicion.habilitada ?? "", fecha_recepcion: enEdicion.fecha_recepcion ?? "", vigencia_hasta: enEdicion.vigencia_hasta ?? "", valor_total: f(enEdicion.valor_total), plazo_dias: enEdicion.plazo_dias ? String(enEdicion.plazo_dias) : "", aiu_pct: f(enEdicion.aiu_pct), anticipo_pct: f(enEdicion.anticipo_pct), crit_experiencia: String(enEdicion.crit_experiencia ?? ""), crit_capacidad: String(enEdicion.crit_capacidad ?? ""), crit_programacion: String(enEdicion.crit_programacion ?? ""), crit_comercial: String(enEdicion.crit_comercial ?? ""), crit_sst: String(enEdicion.crit_sst ?? ""), incluye_polizas: enEdicion.incluye_polizas ? "on" : "", apu_discriminado: enEdicion.apu_discriminado ? "on" : "", enlace: enEdicion.enlace ?? "", observaciones: enEdicion.observaciones ?? "" } : {}} />
          </div>
        </section>
      )}

      {permisos.gestionar && (
        <section className="mt-8" aria-labelledby="t-edit">
          <h2 id="t-edit" className="font-display text-2xl font-bold text-leaf-700">Datos del proceso</h2>
          <details className="mt-3 rounded-card bg-leaf-50 p-5"><summary className="cursor-pointer font-medium text-leaf-700">Editar el proceso</summary>
            <div className="mt-3"><FormularioProceso accion={guardarProceso.bind(null, id, procesoId)} iniciales={inicialesProceso} volverA={base} /></div>
          </details>
          {p.estado !== "adjudicada" && !p.contrato_id && <form action={borrarProceso.bind(null, id, procesoId)} className="mt-3"><BotonEnviar className="text-sm font-medium text-danger underline" textoEnviando="Borrando…">Borrar este proceso y sus ofertas</BotonEnviar></form>}
        </section>
      )}
      <p className="mt-8 text-xs text-muted">{proyecto.nombre}</p>
    </>
  );
}

export default function PaginaProceso({ params, searchParams }: PageProps<"/proyectos/[id]/procesos/[procesoId]">) {
  return <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><Contenido params={params} searchParams={searchParams} /></Suspense>;
}
