import { Suspense } from "react";
import Link from "next/link";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { desdeJson, formatearPesos } from "@/lib/presupuesto/dinero";
import { calcularPresupuesto } from "@/lib/presupuesto/calculos";
import { cargarDatosPresupuesto } from "@/lib/presupuesto/datos";
import { cargarDatosBalance } from "@/lib/presupuesto/balance-datos";
import { calcularBalance } from "@/lib/presupuesto/balance";
import { proyectarCapitulos, type FilaProyeccion } from "@/lib/presupuesto/proyeccion-capitulos";
import { centavos, indice } from "@/lib/pmo/formato";
import { construirCortes } from "@/lib/pmo/cortes";
import { formatearFecha } from "@/lib/formato";
import { Aviso, Titulo } from "@/components/ui";
import { GraficoCortes } from "@/components/grafico-cortes";

type Fila = { fecha_corte: string; bac: number | string; pv: number | string; ev: number | string; ac: number | string; origen: string };

// Signo explícito para las variaciones: «+1.200» sube (más caro), «−300» baja.
const delta = (c: bigint | null) => (c === null ? "—" : c === 0n ? "0" : `${c > 0n ? "+" : "−"}${centavos(c < 0n ? -c : c)}`);
const colorDelta = (c: bigint | null) => (c !== null && c > 0n ? "text-danger" : "");

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, proyecto: p, permisos } = await cargarProyecto(id);
  if (permisos.interventor) return <Aviso>Tu rol no incluye el control de costos.</Aviso>;
  const { data, error } = await supabase.from("mediciones_evm").select("fecha_corte, bac, pv, ev, ac, origen").eq("proyecto_id", id).order("fecha_corte").limit(200);
  const cortes = construirCortes(((data ?? []) as Fila[]).map((f) => ({ fecha: f.fecha_corte, bac: desdeJson(f.bac, 2), pv: desdeJson(f.pv, 2), ev: desdeJson(f.ev, 2), ac: desdeJson(f.ac, 2), origen: f.origen })));
  const ultimo = cortes[cortes.length - 1];

  // Fase 2: el mismo control para cada capítulo (a la fecha), con el reparto de contratos y el avance de las tareas.
  let capitulos: FilaProyeccion[] | null = null;
  try {
    const [datos, balanceDatos, { data: tareas }] = await Promise.all([
      cargarDatosPresupuesto(supabase, id),
      cargarDatosBalance(supabase, id),
      supabase.from("tareas").select("capitulo_id, peso_pct, avance_pct").eq("proyecto_id", id).limit(2000),
    ]);
    const balance = calcularBalance({ presupuesto: calcularPresupuesto(datos), ...balanceDatos });
    capitulos = proyectarCapitulos(balance.capitulos, ((tareas ?? []) as { capitulo_id: string | null; peso_pct: number | string; avance_pct: number | string }[])
      .map((t) => ({ capituloId: t.capitulo_id, peso: desdeJson(t.peso_pct, 4), avance: desdeJson(t.avance_pct, 2) })));
  } catch (e) {
    console.error("Fallo al preparar el control de costos por capítulo:", e);
  }
  const base = `/proyectos/${id}`;

  return (
    <>
      <Link href={base} className="text-sm font-medium text-leaf-600 hover:underline">← Volver al proyecto</Link>
      <div className="mt-4"><Titulo>Control de costos por cortes</Titulo></div>
      <p className="mt-3 text-sm text-muted">{p.nombre}</p>
      <p className="mt-3 max-w-3xl text-sm">
        Cada corte es una medición de <Link href={`${base}/evm`} className="font-medium text-leaf-600 underline">valor ganado</Link>. Se muestra lo <strong>invertido</strong>, lo que falta <strong>por invertir</strong> y
        lo <strong>proyectado</strong> (la estimación a la conclusión, EAC, que la plataforma calcula con el rendimiento real), y cómo cambió frente al corte anterior y frente a la línea base de costo.
        Para ver cómo se reparte entre capítulos y contratos, abre el <Link href={`${base}/presupuesto/balance`} className="font-medium text-leaf-600 underline">balance de costos</Link>.
      </p>
      {error && <div className="mt-4"><Aviso>No se pudieron leer las mediciones{error.code ? ` (código ${error.code})` : ""}.</Aviso></div>}

      {!ultimo ? (
        !error && <p className="mt-6 rounded-card bg-leaf-50 p-6 text-sm text-muted">Aún no hay cortes. Se crean al calcular o registrar el valor ganado en <Link href={`${base}/evm`} className="font-medium text-leaf-600 underline">Valor ganado</Link>.</p>
      ) : (
        <>
          <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label={`Último corte: ${formatearFecha(ultimo.fecha)}`}>
            {([
              ["Invertido", centavos(ultimo.invertido), ultimo.pctInvertido === null ? "" : `${ultimo.pctInvertido.toLocaleString("es-CO", { minimumFractionDigits: 1 })} % de lo proyectado`],
              ["Por invertir", centavos(ultimo.porInvertir), "Proyectado − invertido"],
              ["Proyectado (EAC)", centavos(ultimo.proyectado), "BAC / CPI"],
              ["Línea base (BAC)", centavos(ultimo.bac), ultimo.cambioBac ? `Cambió ${delta(ultimo.cambioBac)} en este corte` : "Sin cambios en este corte"],
            ] as [string, string, string][]).map(([t, v, n]) => (
              <div key={t} className="rounded-card bg-leaf-100 p-4"><p className="text-xs font-medium uppercase tracking-wider text-leaf-800">{t}</p><p className="mt-1 font-display text-xl font-bold text-leaf-700">{v}</p><p className="text-xs text-muted">{n}</p></div>
            ))}
          </section>
          <p className="mt-2 text-xs text-muted">Último corte: {formatearFecha(ultimo.fecha)} · cifras en COP.{ultimo.proyectado === null && " Aún no hay avance o gasto suficiente para proyectar."}</p>

          <section className="mt-8" aria-labelledby="t-graf">
            <h2 id="t-graf" className="font-display text-2xl font-bold text-leaf-700">Evolución corte a corte</h2>
            <div className="mt-3 rounded-card border border-soil-border p-3"><GraficoCortes cortes={cortes} /></div>
          </section>

          <section className="mt-8" aria-labelledby="t-tab">
            <h2 id="t-tab" className="font-display text-2xl font-bold text-leaf-700">Detalle por corte</h2>
            <div className="mt-3 overflow-x-auto rounded-card border border-soil-border">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-leaf-100 text-xs uppercase tracking-wider text-leaf-800">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left font-medium">Corte</th>
                    {["Invertido", "Invertido en el periodo", "Por invertir", "Proyectado (EAC)", "Vs. corte anterior", "Línea base (BAC)", "Vs. línea base", "CPI"].map((h) => <th key={h} scope="col" className="px-3 py-2 text-right font-medium">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[...cortes].reverse().map((c) => (
                    <tr key={c.fecha} className="border-t border-soil-border">
                      <td className="whitespace-nowrap px-3 py-2">{formatearFecha(c.fecha)}<p className="text-xs text-muted">{c.origen === "calculado" ? "Calculado" : "Manual"}</p></td>
                      <td className="px-3 py-2 text-right tabular-nums">{centavos(c.invertido)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{delta(c.invertidoEnPeriodo)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{centavos(c.porInvertir)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{centavos(c.proyectado)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${colorDelta(c.variacionProyectado)}`}>{delta(c.variacionProyectado)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{centavos(c.bac)}{c.cambioBac ? <p className="text-xs text-muted">{delta(c.cambioBac)}</p> : null}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${colorDelta(c.variacionBase)}`}>{delta(c.variacionBase)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{indice(c.cpi)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted">En rojo, lo que se encarece: un proyectado que sube frente al corte anterior o que supera la línea base. «Invertido en el periodo» es lo gastado desde el corte anterior.</p>
          </section>
        </>
      )}

      <section className="mt-8" aria-labelledby="t-cap">
        <h2 id="t-cap" className="font-display text-2xl font-bold text-leaf-700">Por capítulo, a la fecha</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Presupuesto de cada capítulo con sus indirectos, el avance de sus tareas del cronograma (ponderado por peso) y lo facturado a los contratos asignados. El proyectado se calcula como en el proyecto: presupuesto × invertido ÷ valor ganado.
          El «invertido» de un capítulo es lo facturado de sus contratos, así que no coincide necesariamente con el gasto real del proyecto.
        </p>
        {capitulos === null ? (
          <div className="mt-3"><Aviso>No se pudo preparar el control por capítulo.</Aviso></div>
        ) : capitulos.length === 0 ? (
          <p className="mt-3 rounded-card bg-leaf-50 p-5 text-sm text-muted">Aún no hay capítulos en el presupuesto.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-card border border-soil-border">
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="bg-leaf-100 text-xs uppercase tracking-wider text-leaf-800">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Capítulo</th>
                  {["Presupuesto", "Avance", "Invertido", "Por invertir", "Proyectado (EAC)", "Contratado", "Proyectado vs. presupuesto", "Proyectado vs. contrato"].map((h) => <th key={h} scope="col" className="px-3 py-2 text-right font-medium">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {capitulos.map((c) => (
                  <tr key={c.id} className="border-t border-soil-border">
                    <td className="px-3 py-2"><span className="font-medium">{c.codigo}</span> {c.nombre}{c.proyectado === null && <p className="text-xs text-muted">{c.avance === null ? "Sin tareas ligadas al capítulo" : c.invertido === 0n ? "Sin facturado asignado" : "Sin avance"}</p>}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatearPesos(c.presupuesto)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{c.avance === null ? "—" : `${c.avance.toLocaleString("es-CO", { minimumFractionDigits: 1 })} %`}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatearPesos(c.invertido)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{c.porInvertir === null ? "—" : formatearPesos(c.porInvertir)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{c.proyectado === null ? "—" : formatearPesos(c.proyectado)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{c.contratado === 0n ? "—" : formatearPesos(c.contratado)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${c.sobrePresupuesto !== null && c.sobrePresupuesto > 0n ? "text-danger" : ""}`}>{c.sobrePresupuesto === null ? "—" : `${c.sobrePresupuesto > 0n ? "+" : c.sobrePresupuesto < 0n ? "−" : ""}${formatearPesos(c.sobrePresupuesto < 0n ? -c.sobrePresupuesto : c.sobrePresupuesto)}`}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${c.sobreContrato !== null && c.sobreContrato > 0n ? "text-danger" : ""}`}>{c.sobreContrato === null ? "—" : `${c.sobreContrato > 0n ? "+" : c.sobreContrato < 0n ? "−" : ""}${formatearPesos(c.sobreContrato < 0n ? -c.sobreContrato : c.sobreContrato)}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-muted">En rojo, un capítulo que se proyecta por encima de su presupuesto o de lo contratado: señal para revisar si falta un adicional o ajustar el contrato. Es una proyección con el rendimiento de hoy, no una certeza.</p>
      </section>
    </>
  );
}

export default function PaginaControlCostos({ params }: PageProps<"/proyectos/[id]/control-costos">) {
  return <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><Contenido params={params} /></Suspense>;
}
