import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { ES_UUID, formatearFecha, formatearFechaHora } from "@/lib/formato";
import { desdeJson } from "@/lib/presupuesto/dinero";
import { hoyColombia } from "@/lib/pmo/cargar";
import { centavos, porcentaje } from "@/lib/pmo/formato";
import { numeroParametro, type FilaParametro } from "@/lib/pmo/parametros";
import { ETIQUETA_ESTADO_ACTA, ETIQUETA_TIPO_CONTRATO, resumenContrato } from "@/lib/obra/contratos";
import { Aviso, Titulo, claseBoton } from "@/components/ui";
import { BotonEnviar } from "@/components/boton-enviar";
import { AvisoResultado } from "@/components/aviso-resultado";
import { autorizarAnticipo, borrarActa, cambiarEstadoActa, liberarRetencion, radicarActa } from "../acciones";
import { FormularioActa, FormularioAnticipo } from "../formularios";

type Acta = { id: string; numero: number; fecha: string; valor_bruto: number | string; amortizacion: number | string; retencion: number | string; neto: number | string; estado: string };

function Dato({ t, v }: { t: string; v: React.ReactNode }) {
  return <div><dt className="text-xs font-medium uppercase tracking-wider text-leaf-800">{t}</dt><dd className="mt-0.5 whitespace-pre-wrap text-leaf-900">{v || "—"}</dd></div>;
}

async function Contenido({ params, searchParams }: { params: Promise<{ id: string; contratoId: string }>; searchParams: Promise<{ ok?: string; error?: string; aviso?: string }> }) {
  const { id, contratoId } = await params;
  const { ok, error: errorUrl, aviso } = await searchParams;
  if (!ES_UUID.test(contratoId)) notFound();
  const { supabase, proyecto, permisos } = await cargarProyecto(id);
  const { data: c } = await supabase.from("contratos").select("*").eq("id", contratoId).eq("proyecto_id", id).maybeSingle();
  if (!c) notFound();
  const [{ data: as }, { data: pars }, { data: perfiles }, { data: camb }] = await Promise.all([
    supabase.from("actas_pago").select("id, numero, fecha, valor_bruto, amortizacion, retencion, neto, estado").eq("contrato_id", contratoId).order("numero"),
    supabase.from("parametros").select("ambito, ambito_id, clave, valor"),
    supabase.from("perfiles").select("id, nombre"),
    supabase.from("cambios").select("id, codigo, estado_flujo, impacto_costo").eq("contrato_id", contratoId).order("codigo"),
  ]);
  const actas = (as ?? []) as Acta[];
  const parametros = (pars ?? []) as FilaParametro[];
  const nombres = new Map(((perfiles ?? []) as { id: string; nombre: string }[]).map((p) => [p.id, p.nombre]));
  const ctx = { proyectoId: id, portafolioId: proyecto.portafolio_id };
  const maxAnticipo = numeroParametro(parametros, "anticipo_max_pct", ctx, 20);
  const r = resumenContrato(
    { valor: desdeJson(c.valor, 2), anticipoPct: Number(c.anticipo_pct), anticipoValor: desdeJson(c.anticipo_valor, 2), retencionPct: Number(c.retencion_pct) },
    actas.map((a) => ({ valorBruto: desdeJson(a.valor_bruto, 2), amortizacion: desdeJson(a.amortizacion, 2), retencion: desdeJson(a.retencion, 2), neto: desdeJson(a.neto, 2) })),
    c.retencion_liberada,
  );
  const puedeAnticipo = (permisos.director || (permisos.admin && parametros.find((p) => p.clave === "anticipo_admin_puede_autorizar")?.valor === "si")) && actas.length === 0;
  const base = `/proyectos/${id}/contratos/${contratoId}`;
  const ultima = actas[actas.length - 1];

  return (
    <>
      <Link href={`/proyectos/${id}/contratos`} className="text-sm font-medium text-leaf-600 hover:underline">← Volver a los contratos</Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div><Titulo>{c.contratista}</Titulo><p className="mt-2 text-sm text-muted">{proyecto.nombre} · {ETIQUETA_TIPO_CONTRATO[c.tipo]}</p></div>
        {permisos.gestionar && <Link href={`${base}/editar`} className={claseBoton.contorno}>Editar</Link>}
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <AvisoResultado ok={ok === "anticipo" ? "guardado" : ok === "acta" ? "guardado" : ok === "estado_acta" ? "guardado" : ok === "retencion" ? "guardado" : ok === "retencion_revertida" ? "guardado" : ok} />
        {aviso && <Aviso tipo="ok">{aviso.slice(0, 400)}</Aviso>}
        {errorUrl && <Aviso>{errorUrl.slice(0, 400)}</Aviso>}
      </div>

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Resumen del contrato">
        {([
          ["Valor del contrato", `${centavos(desdeJson(c.valor, 2))}`], ["Facturado (bruto)", centavos(r.facturado)],
          ["Ejecutado", porcentaje(r.ejecutadoPct)], ["Saldo por ejecutar", centavos(r.saldoPorEjecutar)],
          ["Anticipo autorizado", centavos(desdeJson(c.anticipo_valor, 2))], ["Anticipo por amortizar", centavos(r.anticipoPendiente)],
          ["Retención acumulada", centavos(r.retenido)], ["Desembolsado", centavos(r.desembolsado)],
        ] as [string, string][]).map(([t, v]) => (
          <div key={t} className="rounded-card bg-leaf-100 p-4"><p className="text-xs font-medium uppercase tracking-wider text-leaf-800">{t}</p><p className="mt-1 font-display text-xl font-bold text-leaf-700">{v}</p>{t === "Valor del contrato" && <p className="text-xs text-muted">COP</p>}</div>
        ))}
      </section>

      <dl className="mt-6 grid gap-4 rounded-card border border-soil-border p-5 sm:grid-cols-2">
        <Dato t="Objeto" v={c.objeto} />
        <Dato t="Retención de garantía" v={`${Number(c.retencion_pct).toLocaleString("es-CO")} % (vigente al crear el contrato)${c.retencion_liberada ? " · liberada" : ""}`} />
        <Dato t="Anticipo" v={Number(c.anticipo_pct) > 0 ? `${Number(c.anticipo_pct).toLocaleString("es-CO")} % — autorizado por ${nombres.get(c.anticipo_autorizado_por) ?? "—"}${c.anticipo_autorizado_en ? ` el ${formatearFechaHora(c.anticipo_autorizado_en)}` : ""}. Motivo: ${c.anticipo_motivo ?? "—"}` : "Sin anticipo"} />
      </dl>

      <section className="mt-8" aria-labelledby="t-anticipo">
        <h2 id="t-anticipo" className="font-display text-2xl font-bold text-leaf-700">Anticipo</h2>
        <p className="mt-1 text-sm text-muted">Es discrecional: lo autoriza el director general según la urgencia o necesidad. Nunca supera el {maxAnticipo} % del contrato. Lo normal es no darlo en contratos menores a la referencia.</p>
        {puedeAnticipo ? (
          <div className="mt-3 rounded-card bg-leaf-50 p-5"><FormularioAnticipo accion={autorizarAnticipo.bind(null, id, contratoId)} pctActual={Number(c.anticipo_pct) > 0 ? String(Number(c.anticipo_pct)).replace(".", ",") : ""} maximo={String(maxAnticipo)} /></div>
        ) : (
          <p className="mt-2 text-sm text-muted">{actas.length > 0 ? "Ya hay actas de pago: el anticipo no se puede cambiar." : "Solo el director general de planificación y proyectos autoriza el anticipo."}</p>
        )}
      </section>

      <section className="mt-8" aria-labelledby="t-actas">
        <h2 id="t-actas" className="font-display text-2xl font-bold text-leaf-700">Actas de pago</h2>
        {actas.length === 0 ? (
          <p className="mt-3 rounded-card bg-leaf-50 p-5 text-sm text-muted">Aún no hay actas.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-card border border-soil-border">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-leaf-100 text-xs uppercase tracking-wider text-leaf-800">
                <tr>{["N.º", "Fecha", "Bruto", "Amortización", "Retención", "Neto a pagar", "Estado", ""].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-soil-border">
                {actas.map((a) => (
                  <tr key={a.id}>
                    <td className="px-3 py-2">{a.numero}</td><td className="whitespace-nowrap px-3 py-2">{formatearFecha(a.fecha)}</td>
                    <td className="px-3 py-2">{centavos(desdeJson(a.valor_bruto, 2))}</td><td className="px-3 py-2">{centavos(desdeJson(a.amortizacion, 2))}</td>
                    <td className="px-3 py-2">{centavos(desdeJson(a.retencion, 2))}</td><td className="px-3 py-2 font-medium">{centavos(desdeJson(a.neto, 2))}</td>
                    <td className="px-3 py-2">{ETIQUETA_ESTADO_ACTA[a.estado]}</td>
                    <td className="px-3 py-2">
                      {permisos.gestionar && a.estado !== "aprobada_pago" && (
                        <div className="flex flex-wrap items-center gap-3">
                          {a.estado === "radicada" && <form action={cambiarEstadoActa.bind(null, id, contratoId, a.id, "en_revision_interventoria")}><BotonEnviar className="text-sm font-medium text-leaf-600 underline" textoEnviando="…">A revisión</BotonEnviar></form>}
                          <form action={cambiarEstadoActa.bind(null, id, contratoId, a.id, "aprobada_pago")}><BotonEnviar className="text-sm font-medium text-leaf-600 underline" textoEnviando="…">Aprobar para pago</BotonEnviar></form>
                          {ultima && a.id === ultima.id && <form action={borrarActa.bind(null, id, contratoId, a.id)}><BotonEnviar className="text-sm font-medium text-danger underline" textoEnviando="…">Borrar</BotonEnviar></form>}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {permisos.gestionar && !c.retencion_liberada && (
          <div className="mt-4 rounded-card bg-leaf-50 p-5"><h3 className="mb-3 font-display text-lg font-bold text-leaf-700">Radicar acta de pago</h3><FormularioActa accion={radicarActa.bind(null, id, contratoId)} hoy={hoyColombia()} /></div>
        )}
      </section>

      <section className="mt-8" aria-labelledby="t-ret">
        <h2 id="t-ret" className="font-display text-2xl font-bold text-leaf-700">Retención de garantía</h2>
        <p className="mt-1 text-sm text-muted">Se libera solo al ejecutar el 100 % del contrato; la liberación puede revertirse.</p>
        {permisos.gestionar && (
          <div className="mt-3">
            {c.retencion_liberada ? (
              <form action={liberarRetencion.bind(null, id, contratoId, false)}><BotonEnviar className={claseBoton.contorno} textoEnviando="Revirtiendo…">Revertir la liberación</BotonEnviar></form>
            ) : (
              <form action={liberarRetencion.bind(null, id, contratoId, true)} className="flex flex-wrap items-center gap-3">
                <BotonEnviar className={claseBoton.secundario} textoEnviando="Liberando…">Liberar la retención ({centavos(r.retenido)} COP)</BotonEnviar>
                {!r.completo && <span className="text-sm text-muted">Disponible al facturar el 100 % ({porcentaje(r.ejecutadoPct)} hoy).</span>}
              </form>
            )}
          </div>
        )}
      </section>

      {((camb ?? []) as { id: string; codigo: string; estado_flujo: string; impacto_costo: number | string }[]).length > 0 && (
        <section className="mt-8" aria-label="Cambios del contrato">
          <h2 className="font-display text-xl font-bold text-leaf-700">Cambios ligados a este contrato (otrosí)</h2>
          <ul className="mt-2 text-sm">
            {((camb ?? []) as { id: string; codigo: string; estado_flujo: string; impacto_costo: number | string }[]).map((x) => (
              <li key={x.id}><Link href={`/proyectos/${id}/cambios/${x.id}`} className="font-medium text-leaf-700 hover:underline">{x.codigo}</Link> · {centavos(desdeJson(x.impacto_costo, 2))} COP · {x.estado_flujo.replaceAll("_", " ")}</li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-muted">Al aprobarse un cambio ligado a un contrato, el valor del contrato se ajusta con el impacto en costo.</p>
        </section>
      )}
    </>
  );
}

export default function PaginaContrato({ params, searchParams }: PageProps<"/proyectos/[id]/contratos/[contratoId]">) {
  return <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><Contenido params={params} searchParams={searchParams} /></Suspense>;
}
