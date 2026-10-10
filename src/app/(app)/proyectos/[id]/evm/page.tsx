import { Suspense } from "react";
import Link from "next/link";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { desdeJson, formatearDecimal } from "@/lib/presupuesto/dinero";
import { calcularEvm } from "@/lib/pmo/evm";
import { centavos, indice, porcentaje } from "@/lib/pmo/formato";
import { formatearFecha } from "@/lib/formato";
import { Aviso, Titulo, claseBoton } from "@/components/ui";
import { BotonEnviar } from "@/components/boton-enviar";
import { AvisoResultado } from "@/components/aviso-resultado";
import { BotonesExportar } from "@/components/botones-exportar";
import { borrarMedicion, calcularAhora, guardarMedicion } from "./acciones";
import { FormularioMedicion } from "./formulario-medicion";

type Fila = { id: string; fecha_corte: string; bac: number | string; pv: number | string; ev: number | string; ac: number | string; origen: string };

async function Contenido({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  const { id } = await params;
  const { ok } = await searchParams;
  const { supabase, proyecto: p, permisos } = await cargarProyecto(id);
  if (permisos.interventor) return <Aviso>Tu rol no incluye el valor ganado.</Aviso>;
  const { data, error } = await supabase.from("mediciones_evm").select("id, fecha_corte, bac, pv, ev, ac, origen").eq("proyecto_id", id).order("fecha_corte", { ascending: false }).limit(200);
  const filas = ((data ?? []) as Fila[]).map((f) => {
    const m = { bac: desdeJson(f.bac, 2), pv: desdeJson(f.pv, 2), ev: desdeJson(f.ev, 2), ac: desdeJson(f.ac, 2) };
    return { ...f, ...m, r: calcularEvm(m) };
  });
  const ultima = filas[0];
  const iniciales: Record<string, string> = ultima ? { bac: formatearDecimal(ultima.bac, 2) } : {};
  const r = ultima?.r;

  return (
    <>
      <Link href={`/proyectos/${id}`} className="text-sm font-medium text-leaf-600 hover:underline">← Volver al proyecto</Link>
      <div className="mt-4"><Titulo>Valor ganado (EVM)</Titulo></div>
      <p className="mt-3 text-sm text-muted">{p.nombre} · en proyectos con área de Obra, el valor ganado se calcula solo desde el presupuesto aprobado, el cronograma y el gasto; la captura manual sirve para proyectos sin esos datos.</p>
      <div className="mt-4"><AvisoResultado ok={ok} /></div>
      <div className="mt-3 flex flex-wrap items-center gap-3"><span className="text-sm text-muted">Exportar:</span><BotonesExportar base={`/proyectos/${id}/exportar/evm`} /></div>
      {error && <div className="mt-4"><Aviso>No se pudieron leer las mediciones{error.code ? ` (código ${error.code})` : ""}.</Aviso></div>}

      {r && ultima ? (
        <section className="mt-6" aria-label="Indicadores de la última medición">
          <p className="mb-3 text-sm text-muted">Última medición: {formatearFecha(ultima.fecha_corte)}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {([
              ["SPI", indice(r.spi), "EV / PV · meta ≥ 0,95"], ["CPI", indice(r.cpi), "EV / AC · meta ≥ 0,95"],
              ["SV (COP)", centavos(r.sv), "EV − PV"], ["CV (COP)", centavos(r.cv), "EV − AC"],
              ["EAC (COP)", centavos(r.eac), "BAC / CPI"], ["ETC (COP)", centavos(r.etc), "EAC − AC"],
              ["TCPI", indice(r.tcpi), "(BAC − EV) / (BAC − AC) · meta ≤ 1,10"], ["VAC (COP)", centavos(r.vac), "BAC − EAC"],
              ["Avance físico", porcentaje(r.avanceFisico), "EV / BAC"], ["Avance plan", porcentaje(r.avancePlan), "PV / BAC"], ["Avance financiero", porcentaje(r.avanceFinanciero), "AC / BAC"],
            ] as [string, string, string][]).map(([t, v, n]) => (
              <div key={t} className="rounded-card bg-leaf-100 p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-leaf-800">{t}</p>
                <p className="mt-1 font-display text-xl font-bold text-leaf-700">{v}</p>
                <p className="text-xs text-muted">{n}</p>
              </div>
            ))}
          </div>
        </section>
      ) : (
        !error && <p className="mt-6 rounded-card bg-leaf-50 p-6 text-sm text-muted">Aún no hay mediciones. {permisos.reportar ? "Registra la primera abajo." : ""}</p>
      )}

      {filas.length > 0 && (
        <section className="mt-8" aria-labelledby="t-hist">
          <h2 id="t-hist" className="font-display text-2xl font-bold text-leaf-700">Historial</h2>
          <div className="mt-3 overflow-x-auto rounded-card border border-soil-border">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-leaf-100 text-xs uppercase tracking-wider text-leaf-800">
                <tr>{["Corte", "Origen", "BAC", "PV", "EV", "AC", "SPI", "CPI", ""].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-soil-border">
                {filas.map((f) => (
                  <tr key={f.id}>
                    <td className="whitespace-nowrap px-3 py-2">{formatearFecha(f.fecha_corte)}</td>
                    <td className="px-3 py-2">{f.origen === "calculado" ? "Calculado" : "Manual"}</td>
                    <td className="px-3 py-2">{centavos(f.bac)}</td><td className="px-3 py-2">{centavos(f.pv)}</td>
                    <td className="px-3 py-2">{centavos(f.ev)}</td><td className="px-3 py-2">{centavos(f.ac)}</td>
                    <td className="px-3 py-2">{indice(f.r.spi)}</td><td className="px-3 py-2">{indice(f.r.cpi)}</td>
                    <td className="px-3 py-2 text-right">
                      {permisos.reportar && (
                        <form action={borrarMedicion.bind(null, id, f.id)}>
                          <BotonEnviar className="text-sm font-medium text-danger underline" textoEnviando="…">Borrar</BotonEnviar>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {permisos.reportar && p.usa_obra && (
        <section className="mt-8 rounded-card bg-leaf-50 p-5" aria-labelledby="t-calc">
          <h2 id="t-calc" className="mb-1 font-display text-lg font-bold text-leaf-700">Calcular desde la obra</h2>
          <p className="mb-3 text-sm text-muted">Toma el BAC de la línea base de costo, el planificado y el avance del cronograma y el gasto registrado. Se actualiza solo cuando cambian el avance o el gasto; este botón fuerza el cálculo de hoy.</p>
          <form action={calcularAhora.bind(null, id)}><BotonEnviar className={claseBoton.secundario} textoEnviando="Calculando…">Calcular valor ganado de hoy</BotonEnviar></form>
        </section>
      )}

      {permisos.reportar && (
        <section className="mt-8 rounded-card bg-leaf-50 p-5" aria-labelledby="t-nueva">
          <h2 id="t-nueva" className="mb-3 font-display text-xl font-bold text-leaf-700">Registrar medición</h2>
          <FormularioMedicion accion={guardarMedicion.bind(null, id)} iniciales={iniciales} />
        </section>
      )}
      <p className="mt-6 text-xs text-muted"><Link href="/" className={`${claseBoton.contorno} !h-8`}>Ver el portafolio</Link></p>
    </>
  );
}

export default function PaginaEvm({ params, searchParams }: PageProps<"/proyectos/[id]/evm">) {
  return <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><Contenido params={params} searchParams={searchParams} /></Suspense>;
}
