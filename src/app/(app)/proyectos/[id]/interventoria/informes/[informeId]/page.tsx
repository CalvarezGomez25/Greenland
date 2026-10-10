import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { ES_UUID, formatearFechaHora } from "@/lib/formato";
import { RECOMENDACIONES_INFORME, TIPOS_INFORME, etiqueta } from "@/lib/interventoria";
import { Aviso, Titulo, claseBoton } from "@/components/ui";
import { BotonEnviar } from "@/components/boton-enviar";
import { AvisoResultado } from "@/components/aviso-resultado";
import { FormularioRegistro } from "../../../r/formulario-registro";
import { firmarInforme, guardarInforme } from "../../acciones";
import type { CampoDef } from "@/lib/registros/tipos";

type Cont = {
  datos?: { contrato: { contratista: string; objeto: string; valor: string } | null; periodo: string; acta: string | null };
  avance?: { reportado: number; verificado: number; diferencia: number; hayVerificado: boolean };
  financiero?: { bruto: string; amortizacion: string; retencion: string; neto: string; estado: string } | null;
  hallazgos?: { abiertos: number; cerrados: number; vencidos: number };
  conceptos?: { total: number; aprobados: number; conObservaciones: number; noAprobados: number };
};

function Seccion({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return <section className="rounded-card border border-soil-border p-5"><h2 className="font-display text-lg font-bold text-leaf-700">{n}. {titulo}</h2><div className="mt-2 text-sm">{children}</div></section>;
}
const pct = (n: number) => `${n.toLocaleString("es-CO", { maximumFractionDigits: 2 })} %`;

async function Contenido({ params, searchParams }: { params: Promise<{ id: string; informeId: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { id, informeId } = await params;
  const { ok, error: errorUrl } = await searchParams;
  if (!ES_UUID.test(informeId)) notFound();
  const { supabase, permisos } = await cargarProyecto(id);
  const { data: i } = await supabase.from("informes_interventoria").select("*").eq("id", informeId).eq("proyecto_id", id).maybeSingle();
  if (!i) notFound();
  const { data: per } = await supabase.from("perfiles").select("id, nombre");
  const nombres = new Map(((per ?? []) as { id: string; nombre: string }[]).map((p) => [p.id, p.nombre]));
  const c = (i.contenido ?? {}) as Cont;
  const firmado = i.estado === "firmado";
  const campos: CampoDef[] = [
    { nombre: "recomendacion", etiqueta: "Recomendación", tipo: "seleccion", opciones: RECOMENDACIONES_INFORME.map(([valor, etiqueta]) => ({ valor, etiqueta })) },
    { nombre: "motivo", etiqueta: "Motivo de la recomendación", tipo: "area" },
  ];

  return (
    <>
      <Link href={`/proyectos/${id}/interventoria/informes`} className="text-sm font-medium text-leaf-600 hover:underline">← Informes</Link>
      <div className="mt-4"><Titulo>{`Informe ${etiqueta(TIPOS_INFORME, i.tipo).split(" (")[0].toLowerCase()}`}</Titulo></div>
      <p className="mt-2 text-sm text-muted">{i.periodo} · {firmado ? `Firmado el ${formatearFechaHora(i.fecha_firma)}` : "Borrador"}</p>
      <div className="mt-4 flex flex-col gap-2"><AvisoResultado ok={ok === "firma" ? "guardado" : ok} />{errorUrl && <Aviso>{errorUrl.slice(0, 400)}</Aviso>}</div>

      <div className="mt-6 flex flex-col gap-4">
        <Seccion n={1} titulo="Datos">
          <p><strong>Periodo:</strong> {c.datos?.periodo ?? i.periodo}</p>
          <p><strong>Contrato:</strong> {c.datos?.contrato ? `${c.datos.contrato.contratista} · ${c.datos.contrato.objeto} · ${c.datos.contrato.valor} COP` : "—"}</p>
          <p><strong>Acta de pago:</strong> {c.datos?.acta ?? "—"}</p>
        </Seccion>
        <Seccion n={2} titulo="Avance">
          {c.avance ? <p>Reportado {pct(c.avance.reportado)} · Verificado {c.avance.hayVerificado ? pct(c.avance.verificado) : "sin verificar"} · Diferencia {c.avance.hayVerificado ? `${c.avance.diferencia.toLocaleString("es-CO")} puntos` : "—"}</p> : <p>—</p>}
        </Seccion>
        <Seccion n={3} titulo="Financiero">
          {c.financiero ? <p>Valor bruto {c.financiero.bruto} · Amortización {c.financiero.amortizacion} · Retención {c.financiero.retencion} · Neto {c.financiero.neto} (COP) · Estado del acta: {c.financiero.estado.replaceAll("_", " ")}</p> : <p>Sin acta de pago asociada.</p>}
        </Seccion>
        <Seccion n={4} titulo="Hallazgos">{c.hallazgos ? <p>Abiertos {c.hallazgos.abiertos} · Cerrados {c.hallazgos.cerrados} · Vencidos {c.hallazgos.vencidos}</p> : <p>—</p>}</Seccion>
        <Seccion n={5} titulo="Conceptos emitidos en el periodo">{c.conceptos ? <p>Total {c.conceptos.total} · Aprobados {c.conceptos.aprobados} · Con observaciones {c.conceptos.conObservaciones} · No aprobados {c.conceptos.noAprobados}</p> : <p>—</p>}</Seccion>
        <Seccion n={6} titulo="Recomendación">
          {firmado || !permisos.interventor ? (
            <p>{i.recomendacion ? `${etiqueta(RECOMENDACIONES_INFORME, i.recomendacion)}. ${i.motivo ?? ""}` : "Sin recomendación registrada."}</p>
          ) : (
            <FormularioRegistro accion={guardarInforme.bind(null, id, informeId)} campos={campos} opciones={{}} iniciales={{ recomendacion: i.recomendacion ?? "", motivo: i.motivo ?? "" }} editando volverA={`/proyectos/${id}/interventoria/informes`} />
          )}
        </Seccion>
        <Seccion n={7} titulo="Firma">
          {firmado ? <p>Firmado por {nombres.get(i.firmado_por) ?? "—"} el {formatearFechaHora(i.fecha_firma)}. El informe ya no se puede modificar.</p> : permisos.interventor ? (
            <form action={firmarInforme.bind(null, id, informeId)} className="flex flex-wrap items-center gap-3"><BotonEnviar className={claseBoton.primario} textoEnviando="Firmando…">Firmar (director de interventoría)</BotonEnviar><span className="text-muted">Solo el director de interventoría de esta asignación puede firmar.</span></form>
          ) : <p className="text-muted">Pendiente de la firma del director de interventoría.</p>}
        </Seccion>
      </div>
    </>
  );
}

export default function PaginaInforme({ params, searchParams }: PageProps<"/proyectos/[id]/interventoria/informes/[informeId]">) {
  return <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><Contenido params={params} searchParams={searchParams} /></Suspense>;
}
