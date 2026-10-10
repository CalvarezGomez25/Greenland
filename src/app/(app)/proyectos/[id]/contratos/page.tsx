import { Suspense } from "react";
import Link from "next/link";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { desdeJson } from "@/lib/presupuesto/dinero";
import { centavos, porcentaje } from "@/lib/pmo/formato";
import { ETIQUETA_TIPO_CONTRATO, resumenContrato } from "@/lib/obra/contratos";
import { Aviso, Titulo, claseBoton } from "@/components/ui";
import { AvisoResultado } from "@/components/aviso-resultado";

type C = { id: string; tipo: string; contratista: string; objeto: string; valor: number | string; anticipo_pct: number | string; anticipo_valor: number | string; retencion_pct: number | string; retencion_liberada: boolean };
type A = { contrato_id: string; valor_bruto: number | string; amortizacion: number | string; retencion: number | string; neto: number | string; estado: string };

async function Contenido({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  const { id } = await params;
  const { ok } = await searchParams;
  const { supabase, proyecto, permisos } = await cargarProyecto(id);
  const [{ data: cs, error }, { data: as }] = await Promise.all([
    supabase.from("contratos").select("id, tipo, contratista, objeto, valor, anticipo_pct, anticipo_valor, retencion_pct, retencion_liberada").eq("proyecto_id", id).order("creado_en"),
    supabase.from("actas_pago").select("contrato_id, valor_bruto, amortizacion, retencion, neto, estado").eq("proyecto_id", id),
  ]);
  const contratos = (cs ?? []) as C[];
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
      {error && <div className="mt-4"><Aviso>No se pudieron leer los contratos{error.code ? ` (código ${error.code})` : ""}.</Aviso></div>}
      {contratos.length === 0 && !error ? (
        <p className="mt-6 rounded-card bg-leaf-50 p-6 text-sm text-muted">Aún no hay contratos.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-card border border-soil-border">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-leaf-100 text-xs uppercase tracking-wider text-leaf-800">
              <tr>{["Contrato", "Valor (COP)", "Facturado", "Ejecutado", "Anticipo pendiente", "Desembolsado", "Retención"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-soil-border">
              {contratos.map((c) => {
                const propias = actas.filter((a) => a.contrato_id === c.id).map((a) => ({ valorBruto: desdeJson(a.valor_bruto, 2), amortizacion: desdeJson(a.amortizacion, 2), retencion: desdeJson(a.retencion, 2), neto: desdeJson(a.neto, 2) }));
                const r = resumenContrato({ valor: desdeJson(c.valor, 2), anticipoPct: Number(c.anticipo_pct), anticipoValor: desdeJson(c.anticipo_valor, 2), retencionPct: Number(c.retencion_pct) }, propias, c.retencion_liberada);
                return (
                  <tr key={c.id}>
                    <td className="px-3 py-2"><Link href={`/proyectos/${id}/contratos/${c.id}`} className="font-medium text-leaf-700 hover:underline">{c.contratista}</Link><p className="text-xs text-muted">{ETIQUETA_TIPO_CONTRATO[c.tipo]} · {c.objeto.length > 60 ? `${c.objeto.slice(0, 60)}…` : c.objeto}</p></td>
                    <td className="px-3 py-2">{centavos(desdeJson(c.valor, 2))}</td>
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
