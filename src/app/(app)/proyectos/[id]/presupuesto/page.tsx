import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { obtenerSesion } from "@/lib/sesion";
import { ES_UUID } from "@/lib/formato";
import { calcularPresupuesto } from "@/lib/presupuesto/calculos";
import { calcularIndicadores, serieCurvaS } from "@/lib/presupuesto/curva";
import { cargarDatosPresupuesto } from "@/lib/presupuesto/datos";
import { Titulo } from "@/components/ui";
import {
  SeccionAdicionales,
  SeccionCurva,
  SeccionGasto,
  SeccionIndicadores,
  SeccionPartidas,
} from "./secciones";

async function ContenidoPresupuesto({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ES_UUID.test(id)) notFound();

  const { supabase } = await obtenerSesion();

  // Si la persona no tiene acceso al proyecto, la base de datos no devuelve la fila: 404.
  const { data: proyecto } = await supabase
    .from("proyectos")
    .select("id, nombre, duracion_meses")
    .eq("id", id)
    .maybeSingle();
  if (!proyecto) notFound();
  const duracion = proyecto.duracion_meses as number;

  const datos = await cargarDatosPresupuesto(supabase, id);
  const presupuesto = calcularPresupuesto(datos);
  const entradaCurva = { costoTotal: presupuesto.costoTotal, duracion, gastoPorMes: datos.gastoPorMes };
  const serie = serieCurvaS(entradaCurva);
  const indicadores = calcularIndicadores({ ...entradaCurva, costoDirecto: presupuesto.costoDirecto });

  return (
    <>
      <Link href={`/proyectos/${id}`} className="text-sm font-medium text-leaf-600 hover:underline">
        ← Volver al proyecto
      </Link>
      <div className="mt-4">
        <Titulo>Presupuesto y costos</Titulo>
      </div>
      <p className="mt-3 text-sm text-muted">{proyecto.nombre as string}</p>

      <SeccionIndicadores indicadores={indicadores} hayPresupuesto={presupuesto.costoTotal > 0n} />
      <SeccionCurva serie={serie} />
      <SeccionPartidas presupuesto={presupuesto} />
      <SeccionAdicionales presupuesto={presupuesto} />
      <SeccionGasto serie={serie} gastoPorMes={datos.gastoPorMes} duracion={duracion} />
    </>
  );
}

export default function PaginaPresupuesto({ params }: PageProps<"/proyectos/[id]/presupuesto">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Cargando presupuesto…</p>}>
      <ContenidoPresupuesto params={params} />
    </Suspense>
  );
}
