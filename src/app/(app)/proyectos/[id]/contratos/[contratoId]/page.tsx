import { Suspense } from "react";
import { Ayuda } from "@/components/ayuda";
import { temaDe } from "@/lib/glosario";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { ES_UUID, formatearFecha, formatearFechaHora } from "@/lib/formato";
import { desdeJson, formatearDecimal } from "@/lib/presupuesto/dinero";
import { diasParaVencer } from "@/lib/actividades";
import { hoyColombia } from "@/lib/pmo/cargar";
import { centavos, porcentaje } from "@/lib/pmo/formato";
import { numeroParametro, type FilaParametro } from "@/lib/pmo/parametros";
import { ETIQUETA_ESTADO_ACTA, ETIQUETA_TIPO_CONTRATO, resumenContrato } from "@/lib/obra/contratos";
import { Aviso, Titulo, claseBoton } from "@/components/ui";
import { BotonEnviar } from "@/components/boton-enviar";
import { AvisoResultado } from "@/components/aviso-resultado";
import { aprobarContrato, asignarContrato, autorizarAnticipo, avanzarEtapa, borrarActa, borrarModificacion, borrarPoliza, cambiarEstadoActa, devolverEtapa, guardarDatosContractuales, guardarModificacion, guardarPoliza, liberarRetencion, quitarAsignacion, radicarActa } from "../acciones";
import { FormularioActa, FormularioAnticipo, FormularioAsignacion, FormularioDatosContractuales, FormularioDevolverEtapa, FormularioModificacion, FormularioPoliza } from "../formularios";
import { cargarExtrasVigilancia } from "@/lib/contratos/datos-vigilancia";
import { SemaforoContrato } from "@/components/semaforo-contrato";
import { ETAPAS, ETIQUETA_TIPO_MODIFICACION, etapaPorNumero, parametrosDeVigilancia, semaforoContrato } from "@/lib/contratos/vigilancia";
import { formatearNit } from "@/lib/aliados";
import { formatearPesos } from "@/lib/presupuesto/dinero";

type Acta = { id: string; numero: number; fecha: string; valor_bruto: number | string; amortizacion: number | string; retencion: number | string; neto: number | string; estado: string };

function Dato({ t, v }: { t: string; v: React.ReactNode }) {
  return <div><dt className="text-xs font-medium uppercase tracking-wider text-leaf-800">{t}</dt><dd className="mt-0.5 whitespace-pre-wrap text-leaf-900">{v || "—"}</dd></div>;
}

async function Contenido({ params, searchParams }: { params: Promise<{ id: string; contratoId: string }>; searchParams: Promise<{ ok?: string; error?: string; aviso?: string; mod?: string }> }) {
  const { id, contratoId } = await params;
  const { ok, error: errorUrl, aviso, mod: modEditar } = await searchParams;
  if (!ES_UUID.test(contratoId)) notFound();
  const { supabase, proyecto, permisos } = await cargarProyecto(id);
  const { data: c } = await supabase.from("contratos").select("*").eq("id", contratoId).eq("proyecto_id", id).maybeSingle();
  if (!c) notFound();
  const [{ data: as }, { data: pars }, { data: perfiles }, { data: camb }, { data: asigs }, { data: caps }, { data: adis }] = await Promise.all([
    supabase.from("actas_pago").select("id, numero, fecha, valor_bruto, amortizacion, retencion, neto, estado").eq("contrato_id", contratoId).order("numero"),
    supabase.from("parametros").select("ambito, ambito_id, clave, valor"),
    supabase.from("perfiles").select("id, nombre"),
    supabase.from("cambios").select("id, codigo, estado_flujo, impacto_costo").eq("contrato_id", contratoId).order("codigo"),
    supabase.from("contrato_asignaciones").select("id, capitulo_id, adicional_id, valor").eq("contrato_id", contratoId),
    supabase.from("capitulos").select("id, codigo, nombre").eq("proyecto_id", id).order("orden"),
    supabase.from("adicionales").select("id, codigo, descripcion").eq("proyecto_id", id).order("codigo"),
  ]);
  // Etapa, semáforo y datos contractuales (capa 1 de aliados): el tercero, el contratante del proyecto y el historial de etapas.
  const [{ data: ter }, { data: hist }, { data: proyC }] = await Promise.all([
    c.tercero_id ? supabase.from("terceros").select("id, nit, razon_social").eq("id", c.tercero_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("contrato_etapa_historial").select("id, etapa_anterior, etapa_nueva, motivo, creado_en").eq("contrato_id", contratoId).order("creado_en", { ascending: false }).limit(20),
    supabase.from("proyectos").select("contratante_id").eq("id", id).maybeSingle(),
  ]);
  const { data: contr } = (proyC as { contratante_id: string | null } | null)?.contratante_id
    ? await supabase.from("contratantes").select("tope_smmlv").eq("id", (proyC as { contratante_id: string }).contratante_id).maybeSingle()
    : { data: null };
  const [{ data: pols }, { data: mods }, { data: amps }, { data: cmbs }] = await Promise.all([
    supabase.from("contrato_polizas").select("id, amparo, aseguradora, numero, valor_asegurado, fecha_expedicion, fecha_vencimiento, estado, enlace").eq("contrato_id", contratoId).order("amparo"),
    supabase.from("contrato_modificaciones").select("id, tipo, numero, fecha_firma, nueva_fecha_fin, valor, descripcion, justificacion, estado, cambio_id").eq("contrato_id", contratoId).order("creado_en"),
    supabase.from("poliza_amparos").select("nombre, orden").order("orden"),
    supabase.from("cambios").select("id, codigo, estado_flujo, descripcion_despues").eq("contrato_id", contratoId).order("codigo"),
  ]);
  const hoy = hoyColombia();
  const extras = (await cargarExtrasVigilancia(supabase, id, [{ id: contratoId, tercero_id: c.tercero_id, valor: c.valor, anticipo_valor: c.anticipo_valor }], hoy, parametrosDeVigilancia((pars ?? []) as FilaParametro[], id).alertaDias)).get(contratoId);
  const polizas = (pols ?? []) as { id: string; amparo: string; aseguradora: string | null; numero: string | null; valor_asegurado: number | string | null; fecha_expedicion: string | null; fecha_vencimiento: string | null; estado: string; enlace: string | null }[];
  const modificaciones = (mods ?? []) as { id: string; tipo: string; numero: number; fecha_firma: string | null; nueva_fecha_fin: string | null; valor: number | string; descripcion: string; justificacion: string | null; estado: string; cambio_id: string | null }[];
  const cambiosContrato = (cmbs ?? []) as { id: string; codigo: string; estado_flujo: string; descripcion_despues: string }[];
  const enEdicion = modEditar && ES_UUID.test(modEditar) ? modificaciones.find((m) => m.id === modEditar) : undefined;
  const tercero = ter as { id: string; nit: string; razon_social: string } | null;
  const historial = (hist ?? []) as { id: number; etapa_anterior: number | null; etapa_nueva: number; motivo: string | null; creado_en: string }[];
  const parametrosV = parametrosDeVigilancia((pars ?? []) as FilaParametro[], id);
  const sem = semaforoContrato({ etapa: c.etapa, fechaEtapa: c.fecha_etapa, fechaFin: c.fecha_fin_vigente, suspendidoDesde: c.suspendido_desde, polizas: extras?.polizas, documentos: extras?.documentos, valor: desdeJson(c.valor, 2), autorizacionAsamblea: c.autorizacion_asamblea, topeSmmlv: (contr as { tope_smmlv: number | null } | null)?.tope_smmlv }, hoy, parametrosV);
  const etapaActual = etapaPorNumero(c.etapa);
  const siguiente = c.etapa < 9 && !(c.estado_aprobacion === "pendiente" && c.etapa >= 3) ? ETAPAS[c.etapa] : null;
  const datosIniciales: Record<string, string> = {
    consecutivo: c.consecutivo ?? "", orden_servicio_sap: c.orden_servicio_sap ?? "", fecha_firma: c.fecha_firma ?? "", fecha_acta_inicio: c.fecha_acta_inicio ?? "",
    plazo_valor: c.plazo_valor ? String(c.plazo_valor) : "", plazo_unidad: c.plazo_unidad ?? "", autorizacion_asamblea: c.autorizacion_asamblea ?? "",
  };
  const asignaciones = (asigs ?? []) as { id: string; capitulo_id: string | null; adicional_id: string | null; valor: number | string }[];
  const capitulos = (caps ?? []) as { id: string; codigo: string; nombre: string }[];
  const adicionales = (adis ?? []) as { id: string; codigo: string; descripcion: string }[];
  const nombreDestino = new Map<string, string>([
    ...capitulos.map((x) => [x.id, `Capítulo ${x.codigo} · ${x.nombre}`] as [string, string]),
    ...adicionales.map((x) => [x.id, `Adicional ${x.codigo} · ${x.descripcion}`] as [string, string]),
  ]);
  const asignado = asignaciones.reduce((t, a) => t + desdeJson(a.valor, 2), 0n);
  const sinAsignar = desdeJson(c.valor, 2) - asignado;
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
  const pendiente = c.estado_aprobacion === "pendiente";
  const puedeAprobar = pendiente && (permisos.director || (permisos.admin && parametros.find((p) => p.clave === "contrato_admin_puede_aprobar")?.valor === "si"));
  const puedeAnticipo = !pendiente && (permisos.director || (permisos.admin && parametros.find((p) => p.clave === "anticipo_admin_puede_autorizar")?.valor === "si")) && actas.length === 0;
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

      {pendiente && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-card border border-soil-border bg-leaf-50 p-4 text-sm">
          <p><strong>Pendiente de aprobación.</strong> El director general de planificación y proyectos revisa y aprueba la nueva contratación. Hasta entonces el contrato no admite anticipo ni actas de pago{permisos.gestionar ? ", pero puedes corregirlo" : ""}.</p>
          {puedeAprobar && <form action={aprobarContrato.bind(null, id, contratoId)}><BotonEnviar className={claseBoton.primario} textoEnviando="Aprobando…">Aprobar contrato</BotonEnviar></form>}
        </div>
      )}

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Resumen del contrato">
        {([
          ["Valor del contrato", `${centavos(desdeJson(c.valor, 2))}`], ["Facturado (bruto)", centavos(r.facturado)],
          ["Ejecutado", porcentaje(r.ejecutadoPct)], ["Saldo por ejecutar", centavos(r.saldoPorEjecutar)],
          ["Anticipo autorizado", centavos(desdeJson(c.anticipo_valor, 2))], ["Anticipo por amortizar", centavos(r.anticipoPendiente)],
          ["Retención acumulada", centavos(r.retenido)], ["Desembolsado", centavos(r.desembolsado)],
        ] as [string, string][]).map(([t, v]) => (
          <Ayuda key={t} modo="tarjeta" tema={temaDe(t)} className="rounded-card bg-leaf-100 p-4"><p className="pr-6 text-xs font-medium uppercase tracking-wider text-leaf-800">{t}</p><p className="mt-1 font-display text-xl font-bold text-leaf-700">{v}</p>{t === "Valor del contrato" && <p className="text-xs text-muted">COP</p>}</Ayuda>
        ))}
      </section>

      <dl className="mt-6 grid gap-4 rounded-card border border-soil-border p-5 sm:grid-cols-2">
        <Dato t="Objeto" v={c.objeto} />
        <Dato t="Aprobación" v={pendiente ? "Pendiente del director general" : c.aprobado_por ? `Aprobado por ${nombres.get(c.aprobado_por) ?? "—"}${c.aprobado_en ? ` el ${formatearFecha(String(c.aprobado_en).slice(0, 10))}` : ""}` : "Aprobado"} />
        <Dato t="Retención de garantía" v={`${Number(c.retencion_pct).toLocaleString("es-CO")} % (vigente al crear el contrato)${c.retencion_liberada ? " · liberada" : ""}`} />
        <Dato t="Anticipo" v={Number(c.anticipo_pct) > 0 ? `${Number(c.anticipo_pct).toLocaleString("es-CO")} % — autorizado por ${nombres.get(c.anticipo_autorizado_por) ?? "—"}${c.anticipo_autorizado_en ? ` el ${formatearFechaHora(c.anticipo_autorizado_en)}` : ""}. Motivo: ${c.anticipo_motivo ?? "—"}` : "Sin anticipo"} />
      </dl>


      <section className="mt-8" aria-labelledby="t-ruta">
        <h2 id="t-ruta" className="font-display text-2xl font-bold text-leaf-700">Ruta del contrato</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <SemaforoContrato nivel={sem.nivel} />
          <span className="text-sm"><strong>Etapa {c.etapa}. {etapaActual.nombre}</strong>{sem.nivel !== "archivado" && ` · ${sem.diasEnEtapa} ${sem.diasEnEtapa === 1 ? "día" : "días"} en esta etapa`}</span>
        </div>
        {[...sem.rojas, ...sem.ambar].length > 0 && (
          <ul className="mt-2 list-disc pl-5 text-sm">{[...sem.rojas, ...sem.ambar].map((t) => <li key={t}>{t}</li>)}</ul>
        )}
        <p className="mt-2 text-sm text-muted"><strong>Responsable:</strong> {etapaActual.responsable}. <strong>Siguiente acción:</strong> {etapaActual.accion}.</p>
        <p className="mt-1 text-xs text-muted">El semáforo vigila la etapa, el plazo (con prórrogas y suspensiones firmadas), la autorización de asamblea, las pólizas y los documentos del contratista. Los compromisos de las comunicaciones llegarán después.</p>
        <ol className="mt-3 flex flex-wrap gap-1.5 text-xs" aria-label="Etapas">
          {ETAPAS.map((e) => <li key={e.n} className={`rounded-full border px-2.5 py-0.5 ${e.n === c.etapa ? "border-leaf-600 bg-leaf-600 font-medium text-white" : e.n < c.etapa ? "border-leaf-400 bg-leaf-100 text-leaf-800" : "border-soil-border text-muted"}`}>{e.n}. {e.nombre}</li>)}
        </ol>
        {permisos.gestionar && (
          <div className="mt-4 flex flex-col gap-4 rounded-card bg-leaf-50 p-5">
            {siguiente && (
              <form action={avanzarEtapa.bind(null, id, contratoId, siguiente.n)}><BotonEnviar className={claseBoton.primario} textoEnviando="Avanzando…">Avanzar a la etapa {siguiente.n}: {siguiente.nombre}</BotonEnviar></form>
            )}
            {pendiente && <p className="text-sm text-muted">El contrato no pasa de la etapa 3 hasta que el director general lo apruebe.</p>}
            {c.etapa > 1 && <FormularioDevolverEtapa accion={devolverEtapa.bind(null, id, contratoId)} opciones={ETAPAS.filter((e) => e.n < c.etapa).map((e) => ({ n: e.n, nombre: e.nombre }))} />}
          </div>
        )}
        {historial.length > 0 && (
          <details className="mt-3 text-sm"><summary className="cursor-pointer font-medium text-leaf-700">Historial de etapas ({historial.length})</summary>
            <ul className="mt-2 space-y-1">{historial.map((h) => <li key={h.id}>{formatearFechaHora(h.creado_en)} · de {h.etapa_anterior ?? "—"} a {h.etapa_nueva}{h.motivo ? ` · ${h.motivo}` : ""}</li>)}</ul>
          </details>
        )}
      </section>

      <section className="mt-8" aria-labelledby="t-datos">
        <h2 id="t-datos" className="font-display text-2xl font-bold text-leaf-700">Datos contractuales</h2>
        <p className="mt-1 text-sm text-muted">
          Contratista: {tercero ? <><Link href={`/aliados/${tercero.id}`} className="font-medium text-leaf-700 hover:underline">{tercero.razon_social}</Link> · NIT {formatearNit(tercero.nit)}</> : <>{c.contratista} (texto: ligarlo al maestro de aliados con «Editar»)</>}.{" "}
          {c.fecha_fin_inicial ? <>Fecha fin inicial: <strong>{formatearFecha(c.fecha_fin_inicial)}</strong> (acta de inicio + plazo).{c.fecha_fin_vigente && c.fecha_fin_vigente !== c.fecha_fin_inicial && <> Fecha fin vigente: <strong>{formatearFecha(c.fecha_fin_vigente)}</strong> (con las prórrogas firmadas).</>}</> : "Con el acta de inicio y el plazo se calcula la fecha fin."}{c.suspendido_desde && <> <strong>Suspendido desde {formatearFecha(c.suspendido_desde)}.</strong></>}
        </p>
        {permisos.gestionar ? (
          <div className="mt-3 rounded-card bg-leaf-50 p-5"><FormularioDatosContractuales accion={guardarDatosContractuales.bind(null, id, contratoId)} iniciales={datosIniciales} /></div>
        ) : (
          <p className="mt-2 text-sm text-muted">Firma: {c.fecha_firma ? formatearFecha(c.fecha_firma) : "—"} · Acta de inicio: {c.fecha_acta_inicio ? formatearFecha(c.fecha_acta_inicio) : "—"} · Consecutivo: {c.consecutivo ?? "—"} · Orden de servicio: {c.orden_servicio_sap ?? "—"}</p>
        )}
      </section>

      <section className="mt-8" aria-labelledby="t-pol">
        <h2 id="t-pol" className="font-display text-2xl font-bold text-leaf-700">Pólizas</h2>
        <p className="mt-1 text-sm text-muted">Una póliza por amparo. El mínimo exigido es el porcentaje del amparo sobre el valor del contrato (o del anticipo). Rojo: vencida o por debajo del mínimo; ámbar: vence en {parametrosV.alertaDias} días o menos, o falta un dato. Se guardan enlaces al soporte, no archivos.</p>
        {polizas.length === 0 ? (
          <p className="mt-3 rounded-card bg-leaf-50 p-5 text-sm text-muted">Aún no hay pólizas registradas para este contrato.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-card border border-soil-border">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-leaf-100 text-xs uppercase tracking-wider text-leaf-800"><tr>{["Amparo", "Aseguradora y N.°", "Valor asegurado", "Mínimo exigido", "Vence", "Estado", ""].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-soil-border">
                {polizas.map((z) => {
                  const e = extras?.polizas.find((x) => x.amparo === z.amparo);
                  const dias = z.fecha_vencimiento ? diasParaVencer(z.fecha_vencimiento, hoy) : null;
                  const bajo = e && e.minimo !== null && e.valorAsegurado !== null && e.valorAsegurado < e.minimo;
                  return (
                    <tr key={z.id}>
                      <td className="px-3 py-2 align-top font-medium">{z.amparo}{z.enlace && <a href={z.enlace} target="_blank" rel="noopener noreferrer" className="ml-2 text-xs font-normal text-leaf-600 underline">soporte</a>}</td>
                      <td className="px-3 py-2 align-top">{z.aseguradora ?? "—"}<p className="text-xs text-muted">{z.numero ?? "sin número"}</p></td>
                      <td className={`px-3 py-2 align-top tabular-nums ${bajo ? "font-medium text-danger" : ""}`}>{z.valor_asegurado === null ? "—" : centavos(desdeJson(z.valor_asegurado, 2))}{bajo && <p className="text-xs">Por debajo del mínimo</p>}</td>
                      <td className="px-3 py-2 align-top tabular-nums">{e?.minimo != null ? centavos(e.minimo) : "—"}</td>
                      <td className={`whitespace-nowrap px-3 py-2 align-top ${z.estado === "activa" && dias !== null && dias < 0 ? "font-medium text-danger" : ""}`}>{z.fecha_vencimiento ? formatearFecha(z.fecha_vencimiento) : "—"}{z.estado === "activa" && dias !== null && <p className="text-xs">{dias < 0 ? `vencida hace ${-dias} d` : `en ${dias} d`}</p>}</td>
                      <td className="px-3 py-2 align-top">{z.estado === "cumplida" ? "Cumplida" : "Activa"}</td>
                      <td className="px-3 py-2 text-right align-top">{permisos.gestionar && <form action={borrarPoliza.bind(null, id, contratoId, z.id)}><BotonEnviar className="text-sm font-medium text-danger underline" textoEnviando="…">Borrar</BotonEnviar></form>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {permisos.gestionar && (
          <details className="mt-3 rounded-card bg-leaf-50 p-5" open={polizas.length === 0}>
            <summary className="cursor-pointer font-medium text-leaf-700">Registrar o corregir una póliza</summary>
            <div className="mt-3"><FormularioPoliza accion={guardarPoliza.bind(null, id, contratoId)} amparos={((amps ?? []) as { nombre: string }[]).map((a) => a.nombre)} /></div>
          </details>
        )}
      </section>

      <section className="mt-8" aria-labelledby="t-mod">
        <h2 id="t-mod" className="font-display text-2xl font-bold text-leaf-700">Modificaciones del contrato</h2>
        <p className="mt-1 text-sm text-muted">Adiciones, otrosíes, prórrogas, suspensiones, reinicios y cesiones. Solo las <strong>firmadas</strong> mueven la fecha fin vigente y la suspensión. El valor vigente del contrato cambia con un cambio aprobado: liga aquí el cambio que originó la modificación.</p>
        {modificaciones.length === 0 ? (
          <p className="mt-3 rounded-card bg-leaf-50 p-5 text-sm text-muted">Este contrato no tiene modificaciones.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-card border border-soil-border">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-leaf-100 text-xs uppercase tracking-wider text-leaf-800"><tr>{["Modificación", "Estado", "Firma", "Nueva fecha fin", "Valor", "Cambio", ""].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-soil-border">
                {modificaciones.map((m) => {
                  const cm = cambiosContrato.find((x) => x.id === m.cambio_id);
                  return (
                    <tr key={m.id}>
                      <td className="px-3 py-2 align-top"><span className="font-medium">{ETIQUETA_TIPO_MODIFICACION[m.tipo]} N.° {m.numero}</span><p className="max-w-xs text-xs text-muted">{m.descripcion.length > 90 ? `${m.descripcion.slice(0, 90)}…` : m.descripcion}</p></td>
                      <td className="px-3 py-2 align-top">{m.estado === "firmada" ? "Firmada" : <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">En trámite</span>}</td>
                      <td className="whitespace-nowrap px-3 py-2 align-top">{m.fecha_firma ? formatearFecha(m.fecha_firma) : "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2 align-top">{m.nueva_fecha_fin ? formatearFecha(m.nueva_fecha_fin) : "—"}</td>
                      <td className="px-3 py-2 align-top tabular-nums">{Number(m.valor) > 0 ? centavos(desdeJson(m.valor, 2)) : "—"}</td>
                      <td className="px-3 py-2 align-top">{cm ? <Link href={`/proyectos/${id}/cambios/${cm.id}`} className="text-leaf-700 hover:underline">{cm.codigo}</Link> : "—"}</td>
                      <td className="px-3 py-2 text-right align-top">
                        {permisos.gestionar && (
                          <div className="flex flex-wrap justify-end gap-3">
                            <Link href={`${base}?mod=${m.id}#t-mod`} className="text-sm font-medium text-leaf-600 underline">Editar</Link>
                            {(m.estado === "en_tramite" || permisos.admin) && <form action={borrarModificacion.bind(null, id, contratoId, m.id)}><BotonEnviar className="text-sm font-medium text-danger underline" textoEnviando="…">Borrar</BotonEnviar></form>}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {permisos.gestionar && !pendiente && (
          <details className="mt-3 rounded-card bg-leaf-50 p-5" open={!!enEdicion || modificaciones.length === 0}>
            <summary className="cursor-pointer font-medium text-leaf-700">{enEdicion ? `Editar ${ETIQUETA_TIPO_MODIFICACION[enEdicion.tipo]} N.° ${enEdicion.numero}` : "Registrar una modificación"}</summary>
            <div className="mt-3">
              <FormularioModificacion
                key={enEdicion?.id ?? "nueva"}
                accion={guardarModificacion.bind(null, id, contratoId, enEdicion?.id ?? null)}
                cambios={cambiosContrato.map((x) => ({ id: x.id, etiqueta: `${x.codigo} · ${x.descripcion_despues.slice(0, 50)}` }))}
                edicion={!!enEdicion} volverA={base}
                iniciales={enEdicion ? { tipo: enEdicion.tipo, estado: enEdicion.estado, fecha_firma: enEdicion.fecha_firma ?? "", nueva_fecha_fin: enEdicion.nueva_fecha_fin ?? "", valor: Number(enEdicion.valor) > 0 ? formatearDecimal(desdeJson(enEdicion.valor, 2), 2) : "", cambio_id: enEdicion.cambio_id ?? "", descripcion: enEdicion.descripcion, justificacion: enEdicion.justificacion ?? "" } : {}}
              />
            </div>
          </details>
        )}
      </section>

      {!permisos.interventor && (
        <section className="mt-8" aria-labelledby="t-asig">
          <h2 id="t-asig" className="font-display text-2xl font-bold text-leaf-700">Asignación al presupuesto</h2>
          <p className="mt-1 text-sm text-muted">
            Reparte el valor del contrato entre los capítulos del presupuesto y los adicionales de obra. Así el <Link href={`/proyectos/${id}/presupuesto/balance`} className="font-medium text-leaf-600 underline">balance</Link> compara
            lo presupuestado contra lo contratado. Asignado {centavos(asignado)} de {centavos(desdeJson(c.valor, 2))} COP; sin asignar {centavos(sinAsignar)}.
          </p>
          {asignaciones.length === 0 ? (
            <p className="mt-3 rounded-card bg-leaf-50 p-5 text-sm text-muted">Este contrato aún no está asignado a ningún capítulo ni adicional.</p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-card border border-soil-border">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="bg-leaf-100 text-xs uppercase tracking-wider text-leaf-800"><tr><th className="px-3 py-2 font-medium">Capítulo o adicional</th><th className="px-3 py-2 text-right font-medium">Valor asignado</th><th className="px-3 py-2"><span className="sr-only">Acciones</span></th></tr></thead>
                <tbody className="divide-y divide-soil-border">
                  {asignaciones.map((a) => (
                    <tr key={a.id}>
                      <td className="px-3 py-2">{nombreDestino.get((a.capitulo_id ?? a.adicional_id) as string) ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{centavos(desdeJson(a.valor, 2))}</td>
                      <td className="px-3 py-2 text-right">{permisos.gestionar && <form action={quitarAsignacion.bind(null, id, contratoId, a.id)}><BotonEnviar className="text-sm font-medium text-danger underline" textoEnviando="…">Quitar</BotonEnviar></form>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {permisos.gestionar && (capitulos.length > 0 || adicionales.length > 0) && (
            <div className="mt-4 rounded-card bg-leaf-50 p-5">
              <FormularioAsignacion
                accion={asignarContrato.bind(null, id, contratoId)}
                sinAsignar={`${formatearPesos(sinAsignar * 10_000n)} COP`}
                destinos={[
                  { grupo: "Capítulos del presupuesto", opciones: capitulos.map((x) => ({ valor: `c:${x.id}`, etiqueta: `${x.codigo} · ${x.nombre}` })) },
                  ...(adicionales.length > 0 ? [{ grupo: "Adicionales de obra", opciones: adicionales.map((x) => ({ valor: `a:${x.id}`, etiqueta: `${x.codigo} · ${x.descripcion.slice(0, 60)}` })) }] : []),
                ]}
              />
            </div>
          )}
        </section>
      )}

      <section className="mt-8" aria-labelledby="t-anticipo">
        <h2 id="t-anticipo" className="font-display text-2xl font-bold text-leaf-700">Anticipo</h2>
        <p className="mt-1 text-sm text-muted">Es discrecional: lo autoriza el director general según la urgencia o necesidad. Nunca supera el {maxAnticipo} % del contrato. Lo normal es no darlo en contratos menores a la referencia.</p>
        {puedeAnticipo ? (
          <div className="mt-3 rounded-card bg-leaf-50 p-5"><FormularioAnticipo accion={autorizarAnticipo.bind(null, id, contratoId)} pctActual={Number(c.anticipo_pct) > 0 ? String(Number(c.anticipo_pct)).replace(".", ",") : ""} maximo={String(maxAnticipo)} /></div>
        ) : (
          <p className="mt-2 text-sm text-muted">{actas.length > 0 ? "Ya hay actas de pago: el anticipo no se puede cambiar." : pendiente ? "El anticipo se puede autorizar cuando el contrato esté aprobado." : "Solo el director general de planificación y proyectos autoriza el anticipo."}</p>
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
        {permisos.gestionar && !pendiente && !c.retencion_liberada && (
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
