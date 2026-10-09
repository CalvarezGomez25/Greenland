import { Suspense } from "react";
import Link from "next/link";
import { calcularPresupuesto } from "@/lib/presupuesto/calculos";
import { cargarContexto } from "@/lib/presupuesto/contexto";
import { calcularIndicadores, serieCurvaS } from "@/lib/presupuesto/curva";
import { cargarDatosPresupuesto } from "@/lib/presupuesto/datos";
import { AvisoResultado } from "@/components/aviso-resultado";
import { describirFallo } from "@/lib/presupuesto/fallos";
import { Aviso, Titulo, claseBoton } from "@/components/ui";
import {
  SeccionAdicionales,
  SeccionCurva,
  SeccionGasto,
  SeccionIndicadores,
  SeccionPartidas,
} from "./secciones";

async function ContenidoPresupuesto({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string | string[] }>;
}) {
  const { id } = await params;
  const { ok } = await searchParams;
  const { supabase, proyecto, permisos } = await cargarContexto(id);

  let calculo;
  try {
    const datos = await cargarDatosPresupuesto(supabase, id);
    const presupuesto = calcularPresupuesto(datos);
    const entradaCurva = { costoTotal: presupuesto.costoTotal, duracion: proyecto.duracion, gastoPorMes: datos.gastoPorMes };
    calculo = {
      datos,
      presupuesto,
      serie: serieCurvaS(entradaCurva),
      indicadores: calcularIndicadores({ ...entradaCurva, costoDirecto: presupuesto.costoDirecto }),
    };
  } catch (e) {
    console.error("Fallo al preparar el presupuesto:", e);
    return (
      <>
        <Link href={`/proyectos/${id}`} className="text-sm font-medium text-leaf-600 hover:underline">
          ← Volver al proyecto
        </Link>
        <div className="mt-4">
          <Titulo>Presupuesto y costos</Titulo>
        </div>
        <div className="mt-4">
          <Aviso>
            No se pudo preparar el presupuesto. Detalle técnico: {describirFallo(e)}. Avisa al administrador.
          </Aviso>
        </div>
      </>
    );
  }
  const { datos, presupuesto, serie, indicadores } = calculo;
  const base = `/proyectos/${id}/presupuesto`;

  return (
    <>
      <Link href={`/proyectos/${id}`} className="text-sm font-medium text-leaf-600 hover:underline">
        ← Volver al proyecto
      </Link>
      <div className="mt-4">
        <Titulo>Presupuesto y costos</Titulo>
      </div>
      <p className="mt-3 text-sm text-muted">{proyecto.nombre}</p>

      {(permisos.editar || permisos.verAuditoria) && (
        <div className="mt-5 flex flex-wrap gap-3">
          {permisos.editar && (
            <>
              <Link href={`${base}/importar`} className={claseBoton.primario}>Importar CSV</Link>
              <Link href={`${base}/partidas/nueva`} className={claseBoton.secundario}>Agregar partida</Link>
              <Link href={`${base}/costos`} className={claseBoton.secundario}>Costos adicionales</Link>
              <Link href={`${base}/gasto`} className={claseBoton.secundario}>Registrar gasto</Link>
            </>
          )}
          {permisos.verAuditoria && (
            <Link href={`${base}/cambios`} className={claseBoton.contorno}>Registro de cambios</Link>
          )}
        </div>
      )}

      <div className="mt-4">
        <AvisoResultado ok={ok} />
      </div>

      <SeccionIndicadores indicadores={indicadores} hayPresupuesto={presupuesto.costoTotal > 0n} />
      <SeccionCurva serie={serie} />
      <SeccionPartidas presupuesto={presupuesto} hrefEditar={permisos.editar ? (idPartida) => `${base}/partidas/${idPartida}` : undefined} />
      <SeccionAdicionales presupuesto={presupuesto} />
      <SeccionGasto serie={serie} gastoPorMes={datos.gastoPorMes} duracion={proyecto.duracion} />
    </>
  );
}

export default function PaginaPresupuesto({ params, searchParams }: PageProps<"/proyectos/[id]/presupuesto">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Cargando presupuesto…</p>}>
      <ContenidoPresupuesto params={params} searchParams={searchParams} />
    </Suspense>
  );
}
