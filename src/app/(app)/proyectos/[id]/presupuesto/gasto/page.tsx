import { Suspense } from "react";
import Link from "next/link";
import { cargarContexto } from "@/lib/presupuesto/contexto";
import { cargarDatosPresupuesto } from "@/lib/presupuesto/datos";
import { formatearPesos } from "@/lib/presupuesto/dinero";
import { AvisoResultado } from "@/components/aviso-resultado";
import { Titulo } from "@/components/ui";
import { borrarGastoMes, registrarGasto } from "../acciones";
import { BorrarMes, FormularioGasto } from "../_formularios/formulario-gasto";

async function Contenido({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string | string[] }> }) {
  const { id } = await params;
  const { ok } = await searchParams;
  const { supabase, proyecto } = await cargarContexto(id, "editar");
  const datos = await cargarDatosPresupuesto(supabase, id);

  const registrados = [...datos.gastoPorMes.keys()].sort((a, b) => a - b);
  const ultimo = registrados.length ? registrados[registrados.length - 1] : 0;
  const meses = Math.max(proyecto.duracion, ultimo);
  const mesSugerido = Math.min(meses, (Array.from({ length: meses }, (_, i) => i + 1).find((m) => !datos.gastoPorMes.has(m)) ?? meses));

  return (
    <>
      <Link href={`/proyectos/${id}/presupuesto`} className="text-sm font-medium text-leaf-600 hover:underline">
        ← Volver al presupuesto
      </Link>
      <div className="mt-4">
        <Titulo>Registrar gasto real</Titulo>
      </div>
      <p className="mt-3 text-sm text-muted">
        {proyecto.nombre} · el mes 1 es el primer mes del proyecto (duración: {proyecto.duracion} meses)
      </p>
      <div className="mt-4">
        <AvisoResultado ok={ok} />
      </div>

      <div className="mt-6">
        <FormularioGasto accion={registrarGasto.bind(null, id)} meses={meses} registrados={registrados} mesSugerido={mesSugerido} />
      </div>

      <section className="mt-10" aria-labelledby="registrados">
        <h2 id="registrados" className="font-display text-2xl font-bold text-leaf-700">
          Gasto registrado
        </h2>
        {registrados.length === 0 ? (
          <p className="mt-3 rounded-card bg-leaf-50 p-6 text-center text-sm text-muted">Aún no hay gasto registrado.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-card border border-soil-border">
            <table className="w-full min-w-[420px] text-sm">
              <thead className="bg-leaf-100 text-left text-leaf-800">
                <tr>
                  <th scope="col" className="px-3 py-2">Mes</th>
                  <th scope="col" className="px-3 py-2 text-right">Gasto del mes</th>
                  <th scope="col" className="px-3 py-2"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {registrados.map((mes) => (
                  <tr key={mes} className="border-t border-soil-border align-top">
                    <td className="px-3 py-2">{mes}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatearPesos(datos.gastoPorMes.get(mes) ?? 0n)}</td>
                    <td className="px-3 py-2 text-right">
                      <BorrarMes accion={borrarGastoMes.bind(null, id)} mes={mes} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

export default function PaginaGasto({ params, searchParams }: PageProps<"/proyectos/[id]/presupuesto/gasto">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}>
      <Contenido params={params} searchParams={searchParams} />
    </Suspense>
  );
}
