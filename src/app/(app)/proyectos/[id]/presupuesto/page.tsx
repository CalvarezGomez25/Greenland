import { Suspense } from "react";
import Link from "next/link";
import { calcularPresupuesto } from "@/lib/presupuesto/calculos";
import { cargarContexto } from "@/lib/presupuesto/contexto";
import { calcularIndicadores, serieCurvaS } from "@/lib/presupuesto/curva";
import { cargarDatosPresupuesto } from "@/lib/presupuesto/datos";
import { AvisoResultado } from "@/components/aviso-resultado";
import { BotonEnviar } from "@/components/boton-enviar";
import { aprobarPresupuesto } from "./acciones";
import { desdeJson, formatearPesos } from "@/lib/presupuesto/dinero";
import { avanceFisico, planificadoDesdeCronograma, sumaPesos, type Tarea } from "@/lib/obra/cronograma";
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
    // Cronograma: si hay tareas con pesos, el planificado sale de ahí (si no, distribución teórica).
    const [{ data: tareasDb }, { data: pr }, { data: lb }] = await Promise.all([
      supabase.from("tareas").select("id, nombre, semana_inicio, duracion_semanas, peso_pct, avance_pct, avance_verificado_pct").eq("proyecto_id", id),
      supabase.from("proyectos").select("fecha_inicio").eq("id", id).maybeSingle(),
      supabase.from("lineas_base").select("bac, version").eq("proyecto_id", id).eq("tipo", "costo").order("version", { ascending: false }).limit(1),
    ]);
    const tareas = (tareasDb ?? []) as Tarea[];
    const desdeCronograma = tareas.length > 0 && sumaPesos(tareas) > 0 && Boolean(pr?.fecha_inicio);
    const planificado = desdeCronograma ? planificadoDesdeCronograma(presupuesto.costoTotal, tareas, pr!.fecha_inicio as string) : undefined;
    const entradaCurva = { costoTotal: presupuesto.costoTotal, duracion: proyecto.duracion, gastoPorMes: datos.gastoPorMes, planificado };
    calculo = {
      datos,
      presupuesto,
      desdeCronograma,
      avanceFisico: tareas.length > 0 ? avanceFisico(tareas).reportado : null,
      lineaBase: ((lb ?? []) as { bac: number | string; version: number }[])[0] ?? null,
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
  const { datos, presupuesto, serie, indicadores, desdeCronograma, avanceFisico: avance, lineaBase } = calculo;
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

      <section aria-label="Línea base de costo" className="mt-6 rounded-card border border-soil-border p-4 text-sm">
        {lineaBase ? (
          <p><strong>Línea base de costo (BAC):</strong> versión {lineaBase.version} · {formatearPesos(desdeJson(lineaBase.bac, 2) * 10_000n)} COP. Los ajustes posteriores nacen de cambios aprobados.</p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p>El presupuesto aún no está aprobado como línea base. El BAC y el valor ganado calculado dependen de ese paso.</p>
            {permisos.editar && presupuesto.costoTotal > 0n && (
              <form action={aprobarPresupuesto.bind(null, id)}><BotonEnviar className={claseBoton.primario} textoEnviando="Aprobando…">Aprobar presupuesto como línea base</BotonEnviar></form>
            )}
          </div>
        )}
      </section>

      <SeccionIndicadores indicadores={indicadores} hayPresupuesto={presupuesto.costoTotal > 0n} avanceFisico={avance} />
      <SeccionCurva serie={serie} desdeCronograma={desdeCronograma} />
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
