import { Suspense } from "react";
import Link from "next/link";
import { cargarContexto } from "@/lib/presupuesto/contexto";
import { cargarDatosPresupuesto } from "@/lib/presupuesto/datos";
import { calcularPresupuesto, ETIQUETA_CATEGORIA } from "@/lib/presupuesto/calculos";
import { ESCALA, formatearDecimal, formatearPesos } from "@/lib/presupuesto/dinero";
import { AvisoResultado } from "@/components/aviso-resultado";
import { Titulo, claseBoton } from "@/components/ui";
import { crearPlantillaCostos } from "../acciones";
import { BotonPlantilla } from "../_formularios/boton-plantilla";

async function Contenido({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string | string[] }> }) {
  const { id } = await params;
  const { ok } = await searchParams;
  const { supabase, proyecto } = await cargarContexto(id, "editar");
  const datos = await cargarDatosPresupuesto(supabase, id);
  const p = calcularPresupuesto(datos);
  const base = `/proyectos/${id}/presupuesto`;
  const nombrePorId = new Map(p.lineas.map((l) => [l.id, l.nombre]));

  return (
    <>
      <Link href={base} className="text-sm font-medium text-leaf-600 hover:underline">
        ← Volver al presupuesto
      </Link>
      <div className="mt-4">
        <Titulo>Costos indirectos (A.I.U.)</Titulo>
      </div>
      <p className="mt-3 text-sm text-muted">{proyecto.nombre}</p>
      <div className="mt-4 flex flex-col gap-3">
        <AvisoResultado ok={ok} />
      </div>

      <p className="mt-4 max-w-2xl text-sm">
        Cada concepto se calcula como un porcentaje del costo directo (hoy $ {formatearPesos(p.costoDirecto)}) o de otro concepto,
        por ejemplo el IVA sobre la utilidad. Los porcentajes los defines tú; la plataforma no fija tasas legales. Valídalos con tu
        contador. Los <strong>adicionales de obra</strong> (trabajos no contemplados en la EDT original o añadidos durante la ejecución) son otro
        concepto: se registran en <Link href={`${base}/adicionales`} className="font-medium text-leaf-600 underline">Adicionales</Link>.
      </p>

      {p.lineas.length === 0 ? (
        <div className="mt-6 max-w-2xl rounded-card bg-leaf-50 p-6">
          <p className="text-sm">
            Este proyecto aún no tiene costos indirectos. Puedes crear los conceptos habituales (Administración, Imprevistos,
            Utilidad, IVA sobre la utilidad y Retefuente) en 0 % y luego completar los porcentajes, o agregar tus propios conceptos.
          </p>
          <div className="mt-4 flex flex-wrap items-start gap-3">
            <BotonPlantilla accion={crearPlantillaCostos.bind(null, id)} />
            <Link href={`${base}/costos/nueva`} className={claseBoton.contorno}>
              Agregar un concepto
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-6 overflow-x-auto rounded-card border border-soil-border">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-leaf-100 text-left text-leaf-800">
                <tr>
                  <th scope="col" className="px-3 py-2">Concepto</th>
                  <th scope="col" className="px-3 py-2">Tipo</th>
                  <th scope="col" className="px-3 py-2">Se calcula sobre</th>
                  <th scope="col" className="px-3 py-2 text-right">Porcentaje</th>
                  <th scope="col" className="px-3 py-2 text-right">Valor</th>
                  <th scope="col" className="px-3 py-2"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {p.lineas.map((l) => (
                  <tr key={l.id} className="border-t border-soil-border">
                    <td className="px-3 py-2">{l.nombre}</td>
                    <td className="px-3 py-2">{ETIQUETA_CATEGORIA[l.categoria ?? "otro"]}</td>
                    <td className="px-3 py-2">{l.base === "costo_directo" ? "Costo directo" : (nombrePorId.get(l.lineaBaseId ?? "") ?? "Otra línea")}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatearDecimal(l.porcentaje, ESCALA.porcentaje)} %</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatearPesos(l.valor)}</td>
                    <td className="px-3 py-2 text-right">
                      <Link href={`${base}/costos/${l.id}`} className="font-medium text-leaf-600 underline">
                        Editar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="font-medium text-leaf-900">
                <tr className="border-t-2 border-leaf-700 bg-leaf-50">
                  <th scope="row" colSpan={4} className="px-3 py-2 text-left">Total costos indirectos</th>
                  <td className="px-3 py-2 text-right tabular-nums">{formatearPesos(p.totalIndirectos)}</td>
                  <td />
                </tr>
                <tr className="bg-leaf-50 font-bold">
                  <th scope="row" colSpan={4} className="px-3 py-2 text-left">Costo total (directo + indirectos)</th>
                  <td className="px-3 py-2 text-right tabular-nums">{formatearPesos(p.costoTotal)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="mt-4">
            <Link href={`${base}/costos/nueva`} className={claseBoton.primario}>
              Agregar un concepto
            </Link>
          </div>
        </>
      )}
    </>
  );
}

export default function PaginaCostos({ params, searchParams }: PageProps<"/proyectos/[id]/presupuesto/costos">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}>
      <Contenido params={params} searchParams={searchParams} />
    </Suspense>
  );
}
