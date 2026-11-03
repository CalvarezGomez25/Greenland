import { Suspense } from "react";
import Link from "next/link";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { desdeJson } from "@/lib/presupuesto/dinero";
import { centavos, porcentaje } from "@/lib/pmo/formato";
import { ETIQUETA_TIPO_CONTRATO, resumenContrato } from "@/lib/obra/contratos";
import { Aviso, Titulo, claseBoton } from "@/components/ui";
import { SemaforoContrato } from "@/components/semaforo-contrato";
import { ETAPAS, ordenarPorUrgencia, parametrosDeVigilancia, semaforoContrato } from "@/lib/contratos/vigilancia";
import { hoyColombia } from "@/lib/actividades";
import { FormularioContratanteProyecto } from "./formularios";
import { asignarContratante } from "./acciones";
import type { FilaParametro } from "@/lib/pmo/parametros";
import { AvisoResultado } from "@/components/aviso-resultado";
import { BotonesExportar } from "@/components/botones-exportar";

type C = { id: string; tipo: string; contratista: string; objeto: string; valor: number | string; anticipo_pct: number | string; anticipo_valor: number | string; retencion_pct: number | string; retencion_liberada: boolean; estado_aprobacion?: string; etapa: number; fecha_etapa: string; fecha_fin_inicial: string | null; autorizacion_asamblea: string | null };
type A = { contrato_id: string; valor_bruto: number | string; amortizacion: number | string; retencion: number | string; neto: number | string; estado: string };

async function Contenido({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  const { id } = await params;
  const { ok } = await searchParams;
  const { supabase, proyecto, permisos } = await cargarProyecto(id);
  const [{ data: cs, error }, { data: as }, { data: asigs }, { data: pars }, { data: contratantes }, { data: proy }] = await Promise.all([
    supabase.from("contratos").select("id, tipo, contratista, objeto, valor, anticipo_pct, anticipo_valor, retencion_pct, retencion_liberada, estado_aprobacion, etapa, fecha_etapa, fecha_fin_inicial, autorizacion_asamblea").eq("proyecto_id", id).order("creado_en"),
    supabase.from("actas_pago").select("contrato_id, valor_bruto, amortizacion, retencion, neto, estado").eq("proyecto_id", id),
    supabase.from("contrato_asignaciones").select("contrato_id, valor").eq("proyecto_id", id),
    supabase.from("parametros").select("ambito, ambito_id, clave, valor"),
    supabase.from("contratantes").select("id, codigo, razon_social, tope_smmlv, estado").order("codigo"),
    supabase.from("proyectos").select("contratante_id").eq("id", id).maybeSingle(),
  ]);
  const contratanteActual = (contratantes ?? []).find((c: { id: string }) => c.id === (proy as { contratante_id: string | null } | null)?.contratante_id) as { id: string; codigo: string; razon_social: string; tope_smmlv: number | null } | undefined;
  const parametrosV = parametrosDeVigilancia((pars ?? []) as FilaParametro[], id);
  const hoy = hoyColombia();
  const asignadoPor = new Map<string, bigint>();
  for (const a of (asigs ?? []) as { contrato_id: string; valor: number | string }[]) asignadoPor.set(a.contrato_id, (asignadoPor.get(a.contrato_id) ?? 0n) + desdeJson(a.valor, 2));
  const contratos = ordenarPorUrgencia(((cs ?? []) as C[]).map((c) => ({
    ...c,
    semaforo: semaforoContrato({ etapa: c.etapa, fechaEtapa: c.fecha_etapa, fechaFin: c.fecha_fin_inicial, valor: desdeJson(c.valor, 2), autorizacionAsamblea: c.autorizacion_asamblea, topeSmmlv: contratanteActual?.tope_smmlv }, hoy, parametrosV),
  })));
  const actas = (as ?? []) as A[];
  return (
    <>
      <Link href={`/proyectos/${id}`} className="text-sm font-medium text-leaf-600 hover:underline">← Volver al proyecto</Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <Titulo>Contratos y pagos</Titulo>
        {permisos.gestionar && <Link href={`/proyectos/${id}/contratos/nuevo`} className={claseBoton.primario}>Registrar contrato</Link>}
      </div>
      <p className="mt-3 text-sm text-muted">{proyecto.nombre} · la plataforma registra y calcula; no ejecuta pagos.</p>
      <div className="mt-4"><AvisoResultado ok={ok} /></div>
      <p className="mt-3 text-sm text-muted">Cada contrato se reparte entre capítulos del presupuesto y adicionales (en el detalle del contrato). El <Link href={`/proyectos/${id}/presupuesto/balance`} className="font-medium text-leaf-600 underline">balance de costos</Link> compara lo presupuestado con lo contratado y facturado.</p>
      <section className="mt-4 rounded-card bg-leaf-50 p-4" aria-label="Contratante del proyecto">
        {permisos.gestionar ? (
          <FormularioContratanteProyecto accion={asignarContratante.bind(null, id)} actual={contratanteActual?.id ?? ""} opciones={((contratantes ?? []) as { id: string; codigo: string; razon_social: string; estado: string }[]).filter((c) => c.estado === "activo" || c.id === contratanteActual?.id).map((c) => ({ id: c.id, etiqueta: `${c.codigo} · ${c.razon_social}` }))} />
        ) : (
          <p className="text-sm"><strong>Contratante:</strong> {contratanteActual ? `${contratanteActual.codigo} · ${contratanteActual.razon_social}` : "sin asignar"}</p>
        )}
        <p className="mt-2 text-xs text-muted">El semáforo vigila la etapa de cada contrato, su plazo y la autorización de asamblea (tope de {contratanteActual?.tope_smmlv ?? parametrosV.topeSmmlv} SMMLV). Las pólizas y los documentos del contratista se sumarán en la siguiente fase. Orden: lo más urgente primero.</p>
      </section>
      <div className="mt-3 flex flex-wrap items-center gap-3"><span className="text-sm text-muted">Exportar:</span><BotonesExportar base={`/proyectos/${id}/exportar/contratos`} /></div>
      {error && <div className="mt-4"><Aviso>No se pudieron leer los contratos{error.code ? ` (código ${error.code})` : ""}.</Aviso></div>}
      {contratos.length === 0 && !error ? (
        <p className="mt-6 rounded-card bg-leaf-50 p-6 text-sm text-muted">Aún no hay contratos.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-card border border-soil-border">
          <table className="w-full min-w-[1060px] text-left text-sm">
            <thead className="bg-leaf-100 text-xs uppercase tracking-wider text-leaf-800">
              <tr>{["Contrato", "Etapa", "Valor (COP)", "Asignado", "Facturado", "Ejecutado", "Anticipo pendiente", "Desembolsado", "Retención"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-soil-border">
              {contratos.map((c) => {
                const propias = actas.filter((a) => a.contrato_id === c.id).map((a) => ({ valorBruto: desdeJson(a.valor_bruto, 2), amortizacion: desdeJson(a.amortizacion, 2), retencion: desdeJson(a.retencion, 2), neto: desdeJson(a.neto, 2) }));
                const r = resumenContrato({ valor: desdeJson(c.valor, 2), anticipoPct: Number(c.anticipo_pct), anticipoValor: desdeJson(c.anticipo_valor, 2), retencionPct: Number(c.retencion_pct) }, propias, c.retencion_liberada);
                return (
                  <tr key={c.id}>
                    <td className="px-3 py-2"><Link href={`/proyectos/${id}/contratos/${c.id}`} className="font-medium text-leaf-700 hover:underline">{c.contratista}</Link>{c.estado_aprobacion === "pendiente" && <span className="ml-2 rounded-full bg-leaf-100 px-2 py-0.5 text-xs font-medium text-leaf-800">Pendiente de aprobación</span>}<p className="text-xs text-muted">{ETIQUETA_TIPO_CONTRATO[c.tipo]} · {c.objeto.length > 60 ? `${c.objeto.slice(0, 60)}…` : c.objeto}</p></td>
                    <td className="px-3 py-2 align-top"><SemaforoContrato nivel={c.semaforo.nivel} /><p className="mt-1 text-xs text-muted">{c.etapa}. {ETAPAS[c.etapa - 1]?.nombre}{c.semaforo.nivel !== "archivado" && ` · ${c.semaforo.diasEnEtapa} d`}</p>{[...c.semaforo.rojas, ...c.semaforo.ambar].map((t) => <p key={t} className="mt-0.5 max-w-[16rem] text-xs">{t}</p>)}</td>
                    <td className="px-3 py-2">{centavos(desdeJson(c.valor, 2))}</td>
                    <td className="px-3 py-2">{(asignadoPor.get(c.id) ?? 0n) === desdeJson(c.valor, 2) ? "Completo" : `${centavos(asignadoPor.get(c.id) ?? 0n)}`}</td>
                    <td className="px-3 py-2">{centavos(r.facturado)}</td>
                    <td className="px-3 py-2">{porcentaje(r.ejecutadoPct)}</td>
                    <td className="px-3 py-2">{centavos(r.anticipoPendiente)}</td>
                    <td className="px-3 py-2">{centavos(r.desembolsado)}</td>
                    <td className="px-3 py-2">{c.retencion_liberada ? "Liberada" : `${centavos(r.retenido)} retenido`}</td>
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

export default function PaginaContratos({ params, searchParams }: PageProps<"/proyectos/[id]/contratos">) {
  return <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><Contenido params={params} searchParams={searchParams} /></Suspense>;
}
