import { Suspense } from "react";
import Link from "next/link";
import { cargarContexto } from "@/lib/presupuesto/contexto";
import { calcularPresupuesto } from "@/lib/presupuesto/calculos";
import { cargarDatosPresupuesto } from "@/lib/presupuesto/datos";
import { cargarDatosBalance } from "@/lib/presupuesto/balance-datos";
import { ETIQUETA_ESTADO_ADICIONAL, ETIQUETA_ORIGEN_ADICIONAL, calcularBalance } from "@/lib/presupuesto/balance";
import { formatearPesos } from "@/lib/presupuesto/dinero";
import { AvisoResultado } from "@/components/aviso-resultado";
import { Titulo, claseBoton } from "@/components/ui";

async function Contenido({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string | string[] }> }) {
  const { id } = await params;
  const { ok } = await searchParams;
  const { supabase, proyecto, permisos } = await cargarContexto(id);
  const base = `/proyectos/${id}/presupuesto`;
  const presupuesto = calcularPresupuesto(await cargarDatosPresupuesto(supabase, id));
  const datos = await cargarDatosBalance(supabase, id);
  const balance = calcularBalance({ presupuesto, ...datos });
  const cambios = new Map(datos.adicionales.map((a) => [a.id, a.cambioCodigo]));

  return (
    <>
      <Link href={base} className="text-sm font-medium text-leaf-600 hover:underline">← Volver al presupuesto</Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <Titulo>Adicionales de obra</Titulo>
        {permisos.editar && <Link href={`${base}/adicionales/nuevo`} className={claseBoton.primario}>Registrar adicional</Link>}
      </div>
      <p className="mt-3 text-sm text-muted">{proyecto.nombre}</p>
      <div className="mt-4"><AvisoResultado ok={ok} /></div>
      <p className="mt-4 max-w-2xl text-sm">
        Un adicional es un trabajo que <strong>no estaba contemplado en la EDT original</strong> o que <strong>llegó como añadidura durante la ejecución</strong>.
        No es lo mismo que los costos indirectos (A.I.U.). Queda «Aprobado» cuando el cambio que lo respalda se aprueba en el control de cambios;
        solo entonces cuenta en el <Link href={`${base}/balance`} className="font-medium text-leaf-600 underline">balance con contratos</Link>.
      </p>
      {balance.adicionales.length === 0 ? (
        <p className="mt-6 rounded-card bg-leaf-50 p-6 text-sm text-muted">Aún no hay adicionales registrados.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-card border border-soil-border">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-leaf-100 text-xs uppercase tracking-wider text-leaf-800">
              <tr>
                <th className="px-3 py-2 font-medium">Adicional</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 text-right font-medium">Valor directo</th>
                <th className="px-3 py-2 text-right font-medium">Con indirectos</th>
                <th className="px-3 py-2 text-right font-medium">Contratado</th>
                <th className="px-3 py-2"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-soil-border">
              {balance.adicionales.map((f) => (
                <tr key={f.id}>
                  <td className="px-3 py-2">
                    <span className="font-medium">{f.codigo}</span> · {f.nombre}
                    <p className="text-xs text-muted">{ETIQUETA_ORIGEN_ADICIONAL[datos.adicionales.find((a) => a.id === f.id)?.origen ?? ""] ?? ""}{cambios.get(f.id) ? ` · Cambio ${cambios.get(f.id)}` : " · Sin cambio ligado"}</p>
                  </td>
                  <td className="px-3 py-2">{f.estado ? ETIQUETA_ESTADO_ADICIONAL[f.estado] : ""}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatearPesos(f.presupuestoDirecto)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatearPesos(f.presupuesto)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatearPesos(f.contratado)}</td>
                  <td className="px-3 py-2 text-right">{permisos.editar && <Link href={`${base}/adicionales/${f.id}`} className="font-medium text-leaf-600 underline">Editar</Link>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function PaginaAdicionales({ params, searchParams }: PageProps<"/proyectos/[id]/presupuesto/adicionales">) {
  return <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><Contenido params={params} searchParams={searchParams} /></Suspense>;
}
