import { Suspense } from "react";
import Link from "next/link";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { desdeJson } from "@/lib/presupuesto/dinero";
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
    </>
  );
}

export default function PaginaControlCostos({ params }: PageProps<"/proyectos/[id]/control-costos">) {
  return <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><Contenido params={params} /></Suspense>;
}
