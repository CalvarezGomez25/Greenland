import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { hoyColombia } from "@/lib/actividades";
import { desdeJson, formatearPesos } from "@/lib/presupuesto/dinero";
import { formatearFecha } from "@/lib/formato";
import { numeroParametro, type FilaParametro } from "@/lib/pmo/parametros";
import { ETIQUETA_ESTADO_PROCESO, ETIQUETA_TIPO_SERVICIO, calcularOfertas, pesosDeOfertas, semaforoProceso, type EstadoOferta, type EstadoProceso } from "@/lib/contratos/ofertas";
import { Aviso, Titulo, claseBoton } from "@/components/ui";
import { AvisoResultado } from "@/components/aviso-resultado";

const PUNTO = { rojo: "bg-red-600", ambar: "bg-amber-500", verde: "bg-leaf-500" } as const;
const ETIQ = { rojo: "Rojo", ambar: "Ámbar", verde: "Verde" } as const;

async function Contenido({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  const { id } = await params;
  const { ok } = await searchParams;
  const { supabase, proyecto, permisos } = await cargarProyecto(id);
  if (permisos.interventor) redirect(`/proyectos/${id}`);
  const [{ data: ps, error }, { data: os }, { data: pars }] = await Promise.all([
    supabase.from("procesos").select("id, codigo, objeto, tipo_servicio, cierre_propuestas, presupuesto_referencia, estado, contrato_id, adjudicatario_id").eq("proyecto_id", id).order("codigo"),
    supabase.from("ofertas").select("id, proceso_id, oferente, ronda, estado, habilitada, valor_total, vigencia_hasta, crit_experiencia, crit_capacidad, crit_programacion, crit_comercial, crit_sst").eq("proyecto_id", id).limit(5000),
    supabase.from("parametros").select("ambito, ambito_id, clave, valor"),
  ]);
  const hoy = hoyColombia();
  const filas = (pars ?? []) as FilaParametro[];
  const pesos = pesosDeOfertas(filas, id), evalDias = numeroParametro(filas, "proceso_eval_dias", { proyectoId: id }, 15), alerta = numeroParametro(filas, "alerta_ambar_dias", { proyectoId: id }, 30);
  type P = { id: string; codigo: string; objeto: string; tipo_servicio: string; cierre_propuestas: string | null; presupuesto_referencia: number | string | null; estado: EstadoProceso; contrato_id: string | null; adjudicatario_id: string | null };
  type O = { id: string; proceso_id: string; oferente: string; ronda: number; estado: EstadoOferta; habilitada: "si" | "no" | null; valor_total: number | string | null; vigencia_hasta: string | null; crit_experiencia: number | null; crit_capacidad: number | null; crit_programacion: number | null; crit_comercial: number | null; crit_sst: number | null };
  const procesos = (ps ?? []) as P[], ofertas = (os ?? []) as O[];

  return (
    <>
      <Link href={`/proyectos/${id}`} className="text-sm font-medium text-leaf-600 hover:underline">← Volver al proyecto</Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <Titulo>Procesos de contratación</Titulo>
        {permisos.gestionar && <Link href={`/proyectos/${id}/procesos/nuevo`} className={claseBoton.primario}>Registrar proceso</Link>}
      </div>
      <p className="mt-3 text-sm text-muted">{proyecto.nombre} · invitaciones, ofertas por ronda y comparativo con puntaje. La interventoría recomienda pero no adjudica: por eso no ve esta pantalla.</p>
      <div className="mt-4"><AvisoResultado ok={ok} /></div>
      {error && <div className="mt-4"><Aviso>No se pudieron leer los procesos{error.code ? ` (código ${error.code})` : ""}.</Aviso></div>}
      {procesos.length === 0 && !error ? (
        <p className="mt-6 rounded-card bg-leaf-50 p-6 text-sm text-muted">Aún no hay procesos de contratación en este proyecto.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-card border border-soil-border">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="bg-leaf-100 text-xs uppercase tracking-wider text-leaf-800"><tr>{["Proceso", "Estado", "Cierre", "Ofertas con valor", "Menor oferta", "Mejor puntaje", "Alerta"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-soil-border">
              {procesos.map((p) => {
                const propias = ofertas.filter((o) => o.proceso_id === p.id);
                const calc = calcularOfertas(propias.map((o) => ({ id: o.id, ronda: o.ronda, estado: o.estado, habilitada: o.habilitada, valor: o.valor_total === null ? null : desdeJson(o.valor_total, 2), criterios: [o.crit_experiencia, o.crit_capacidad, o.crit_programacion, o.crit_comercial, o.crit_sst], vigenciaHasta: o.vigencia_hasta })), p.presupuesto_referencia === null ? null : desdeJson(p.presupuesto_referencia, 2), pesos, hoy, alerta);
                const conValor = propias.filter((o) => o.valor_total !== null && Number(o.valor_total) > 0 && o.estado !== "descartada");
                const menor = conValor.length ? conValor.reduce((a, b) => (Number(b.valor_total) < Number(a.valor_total) ? b : a)) : null;
                const mejor = [...calc.values()].filter((c) => c.total !== null).sort((a, b) => (b.total as number) - (a.total as number))[0];
                const mejorO = mejor ? propias.find((o) => o.id === mejor.id) : null;
                const sem = semaforoProceso({ estado: p.estado, cierre: p.cierre_propuestas, contratoId: p.contrato_id }, hoy, evalDias);
                return (
                  <tr key={p.id}>
                    <td className="px-3 py-2 align-top"><Link href={`/proyectos/${id}/procesos/${p.id}`} className="font-medium text-leaf-700 hover:underline">{p.codigo}</Link><p className="max-w-sm text-xs text-muted">{ETIQUETA_TIPO_SERVICIO[p.tipo_servicio]} · {p.objeto.length > 80 ? `${p.objeto.slice(0, 80)}…` : p.objeto}</p></td>
                    <td className="px-3 py-2 align-top">{ETIQUETA_ESTADO_PROCESO[p.estado]}</td>
                    <td className="whitespace-nowrap px-3 py-2 align-top">{p.cierre_propuestas ? formatearFecha(p.cierre_propuestas) : "—"}</td>
                    <td className="px-3 py-2 align-top tabular-nums">{conValor.length}</td>
                    <td className="px-3 py-2 align-top tabular-nums">{menor ? <>{formatearPesos(desdeJson(menor.valor_total as number | string, 2) * 10_000n)}<p className="text-xs text-muted">{menor.oferente}</p></> : "—"}</td>
                    <td className="px-3 py-2 align-top tabular-nums">{mejor && mejorO ? <>{(mejor.total as number).toLocaleString("es-CO", { minimumFractionDigits: 1 })}<p className="text-xs text-muted">{mejorO.oferente}</p></> : <span className="text-muted">Sin evaluación cualitativa</span>}</td>
                    <td className="px-3 py-2 align-top">{sem.nivel ? <><span className="inline-flex items-center gap-1.5 text-xs font-medium"><span aria-hidden className={`h-2 w-2 rounded-full ${PUNTO[sem.nivel]}`} />{ETIQ[sem.nivel]}</span>{sem.alerta && <p className="mt-0.5 max-w-[16rem] text-xs">{sem.alerta}</p>}</> : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function PaginaProcesos({ params, searchParams }: PageProps<"/proyectos/[id]/procesos">) {
  return <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><Contenido params={params} searchParams={searchParams} /></Suspense>;
}
