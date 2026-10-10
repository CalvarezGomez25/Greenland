import { Suspense } from "react";
import Link from "next/link";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { hoyColombia } from "@/lib/pmo/cargar";
import { avanceFisico, planificadoPct, semanaFinal, semanasTranscurridas, sumaPesos, type Tarea } from "@/lib/obra/cronograma";
import { valorParametro, type FilaParametro } from "@/lib/pmo/parametros";
import { Aviso, Titulo, claseBoton } from "@/components/ui";
import { BotonEnviar } from "@/components/boton-enviar";
import { AvisoResultado } from "@/components/aviso-resultado";
import { guardarAvance, moverTarea, verificarAvance } from "./acciones";
import { Gantt } from "./gantt";

const pct = (n: number) => `${n.toLocaleString("es-CO", { maximumFractionDigits: 2 })} %`;

async function Contenido({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { id } = await params;
  const { ok, error: errorUrl } = await searchParams;
  const { supabase, proyecto, permisos } = await cargarProyecto(id);
  const [{ data, error }, { data: pars }] = await Promise.all([
    supabase.from("tareas").select("id, nombre, semana_inicio, duracion_semanas, peso_pct, avance_pct, avance_verificado_pct, nota_verificacion, orden").eq("proyecto_id", id).order("orden").order("semana_inicio"),
    supabase.from("parametros").select("ambito, ambito_id, clave, valor"),
  ]);
  const tareas = (data ?? []) as (Tarea & { nota_verificacion: string | null })[];
  const usaVerificado = valorParametro((pars ?? []) as FilaParametro[], "ev_usa_avance_verificado", { proyectoId: id, portafolioId: proyecto.portafolio_id }) !== "no";
  const av = avanceFisico(tareas, usaVerificado);
  const hoy = hoyColombia();
  const k = semanasTranscurridas(proyecto.fecha_inicio, hoy);
  const suma = sumaPesos(tareas);
  const puedeAvance = permisos.gestionar || permisos.supervisor;

  return (
    <>
      <Link href={`/proyectos/${id}`} className="text-sm font-medium text-leaf-600 hover:underline">← Volver al proyecto</Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <Titulo>Cronograma y avance</Titulo>
        {permisos.gestionar && <Link href={`/proyectos/${id}/r/tareas/nuevo`} className={claseBoton.primario}>Agregar tarea</Link>}
      </div>
      <p className="mt-3 text-sm text-muted">{proyecto.nombre} · semana {Math.floor(k) + 1} del proyecto · los pesos suman {suma.toLocaleString("es-CO", { maximumFractionDigits: 4 })} %</p>
      <div className="mt-4 flex flex-col gap-2">
        <AvisoResultado ok={ok} />
        {errorUrl && <Aviso>{errorUrl.slice(0, 400)}</Aviso>}
        {error && <Aviso>No se pudieron leer las tareas{error.code ? ` (código ${error.code})` : ""}.</Aviso>}
        {tareas.length > 0 && Math.abs(suma - 100) > 0.0001 && <Aviso>La suma de los pesos debe ser 100 % y hoy es {suma.toLocaleString("es-CO", { maximumFractionDigits: 4 })} %. Ajusta los pesos para que el avance y el valor ganado sean correctos.</Aviso>}
      </div>

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5" aria-label="Avance físico">
        {([
          ["Avance reportado", pct(av.reportado), "Supervisor de obra"],
          ["Avance verificado", av.hayVerificado ? pct(av.verificado) : "—", "Interventoría"],
          ["Diferencia", av.hayVerificado ? `${av.diferencia.toLocaleString("es-CO")} pts` : "—", "reportado − verificado"],
          ["Avance usado en el EV", pct(av.usado), usaVerificado ? "verificado si existe" : "reportado"],
          ["Planificado a hoy", pct(planificadoPct(tareas, k)), "según el cronograma"],
        ] as [string, string, string][]).map(([t, v, n]) => (
          <div key={t} className="rounded-card bg-leaf-100 p-4"><p className="text-xs font-medium uppercase tracking-wider text-leaf-800">{t}</p><p className="mt-1 font-display text-xl font-bold text-leaf-700">{v}</p><p className="text-xs text-muted">{n}</p></div>
        ))}
      </section>

      {tareas.length === 0 && !error ? (
        <p className="mt-6 rounded-card bg-leaf-50 p-6 text-sm text-muted">Aún no hay tareas. {permisos.gestionar ? "Agrega la primera con su semana de inicio, su duración y su peso (los pesos deben sumar 100 %)." : ""}</p>
      ) : (
        <>
          <section className="mt-8" aria-labelledby="t-gantt">
            <h2 id="t-gantt" className="mb-3 font-display text-2xl font-bold text-leaf-700">Gantt</h2>
            <Gantt
              barras={tareas.map((t) => ({ id: t.id, nombre: t.nombre, inicio: t.semana_inicio, duracion: t.duracion_semanas, avance: Number(t.avance_pct) }))}
              semanas={semanaFinal(tareas)}
              semanaActual={Math.floor(k) + 1}
              editable={permisos.gestionar}
              guardar={moverTarea.bind(null, id)}
            />
          </section>

          <section className="mt-8" aria-labelledby="t-tabla">
            <h2 id="t-tabla" className="mb-3 font-display text-2xl font-bold text-leaf-700">Tareas</h2>
            <div className="overflow-x-auto rounded-card border border-soil-border">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="bg-leaf-100 text-xs uppercase tracking-wider text-leaf-800">
                  <tr>{["Tarea", "Inicio", "Duración", "Peso", "Avance", "Verificado", ""].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-soil-border">
                  {tareas.map((t) => (
                    <tr key={t.id}>
                      <td className="px-3 py-2 font-medium">{t.nombre}</td>
                      <td className="px-3 py-2">sem. {t.semana_inicio}</td>
                      <td className="px-3 py-2">{t.duracion_semanas} sem.</td>
                      <td className="px-3 py-2">{pct(Number(t.peso_pct))}</td>
                      <td className="px-3 py-2">
                        {puedeAvance ? (
                          <form action={guardarAvance.bind(null, id, t.id)} className="flex items-center gap-1">
                            <input name="avance" inputMode="decimal" defaultValue={String(Number(t.avance_pct)).replace(".", ",")} aria-label={`Avance de ${t.nombre}`} className="h-9 w-20 rounded-[10px] border border-soil-border px-2" />
                            <BotonEnviar className="text-sm font-medium text-leaf-600 underline" textoEnviando="…">Guardar</BotonEnviar>
                          </form>
                        ) : pct(Number(t.avance_pct))}
                      </td>
                      <td className="px-3 py-2">
                        {permisos.interventor ? (
                          <form action={verificarAvance.bind(null, id, t.id)} className="flex flex-col gap-1">
                            <input name="verificado" inputMode="decimal" defaultValue={t.avance_verificado_pct === null ? "" : String(Number(t.avance_verificado_pct)).replace(".", ",")} aria-label={`Avance verificado de ${t.nombre}`} className="h-9 w-20 rounded-[10px] border border-soil-border px-2" />
                            <input name="nota" defaultValue={t.nota_verificacion ?? ""} placeholder="Nota de verificación" maxLength={500} aria-label="Nota de verificación" className="h-9 w-44 rounded-[10px] border border-soil-border px-2" />
                            <BotonEnviar className="self-start text-sm font-medium text-leaf-600 underline" textoEnviando="…">Verificar</BotonEnviar>
                          </form>
                        ) : t.avance_verificado_pct === null ? "—" : <span title={t.nota_verificacion ?? ""}>{pct(Number(t.avance_verificado_pct))}</span>}
                      </td>
                      <td className="px-3 py-2 text-right">{permisos.gestionar && <Link href={`/proyectos/${id}/r/tareas/${t.id}`} className="font-medium text-leaf-600 hover:underline">Editar</Link>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      <p className="mt-6 text-sm"><Link href={`/proyectos/${id}/r/hitos`} className="font-medium text-leaf-600 hover:underline">Hitos del proyecto</Link> · <Link href={`/proyectos/${id}/evm`} className="font-medium text-leaf-600 hover:underline">Valor ganado</Link></p>
    </>
  );
}

export default function PaginaCronograma({ params, searchParams }: PageProps<"/proyectos/[id]/cronograma">) {
  return <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><Contenido params={params} searchParams={searchParams} /></Suspense>;
}
