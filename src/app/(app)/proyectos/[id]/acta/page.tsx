import { Suspense } from "react";
import Link from "next/link";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { formatearDecimal, aEscalado } from "@/lib/presupuesto/dinero";
import { formatearFecha } from "@/lib/formato";
import { ETIQUETA_ESTADO, ETIQUETA_FASE, ETIQUETA_TIPO } from "@/lib/tipos";
import { Aviso, Titulo, claseBoton } from "@/components/ui";
import { BotonEnviar } from "@/components/boton-enviar";
import { AvisoResultado } from "@/components/aviso-resultado";
import { firmarActa, guardarActa } from "./acciones";
import { FormularioActa } from "./formulario-acta";

type Acta = Record<string, string | number | null>;

async function Contenido({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  const { id } = await params;
  const { ok } = await searchParams;
  const { supabase, proyecto: p, permisos } = await cargarProyecto(id);
  if (permisos.interventor) return <Aviso>Tu rol no incluye el acta de constitución.</Aviso>;
  const { data } = await supabase.from("actas_constitucion").select("*").eq("proyecto_id", id).maybeSingle();
  const acta = (data ?? null) as Acta | null;

  const iniciales: Record<string, string> = {};
  if (acta) {
    for (const [k, v] of Object.entries(acta)) iniciales[k] = v === null ? "" : String(v);
    if (acta.presupuesto_estimado !== null && acta.presupuesto_estimado !== undefined) {
      iniciales.presupuesto_estimado = formatearDecimal(aEscalado(String(acta.presupuesto_estimado), 2), 2, 0);
    }
  }
  const fecha = (x: unknown) => (typeof x === "string" ? formatearFecha(x) : null);

  return (
    <>
      <Link href={`/proyectos/${id}`} className="text-sm font-medium text-leaf-600 hover:underline">← Volver al proyecto</Link>
      <div className="mt-4"><Titulo>Ficha y acta de constitución</Titulo></div>
      <div className="mt-4">{ok === "firma_no" ? <Aviso>No se pudo registrar la firma: revisa que tengas ese rol y que el acta esté guardada.</Aviso> : ok === "firma" ? <Aviso tipo="ok">Firma registrada.</Aviso> : <AvisoResultado ok={ok} />}</div>

      <dl className="mt-6 grid gap-4 rounded-card bg-leaf-100 p-5 sm:grid-cols-3">
        {([
          ["Código", p.codigo], ["Nombre", p.nombre], ["Tipo", ETIQUETA_TIPO[p.tipo]], ["Cliente", p.cliente], ["Ubicación", p.ubicacion],
          ["Fase", ETIQUETA_FASE[p.fase]], ["Estado", ETIQUETA_ESTADO[p.estado]], ["Inicio", formatearFecha(p.fecha_inicio)], ["Duración", `${p.duracion_meses} meses`],
        ] as [string, string | null][]).map(([t, v]) => (
          <div key={t}><dt className="text-xs font-medium uppercase tracking-wider text-leaf-800">{t}</dt><dd className="mt-0.5 text-leaf-900">{v || "—"}</dd></div>
        ))}
      </dl>

      <section className="mt-8" aria-labelledby="t-firmas">
        <h2 id="t-firmas" className="font-display text-2xl font-bold text-leaf-700">Firmas</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {(["gerente", "patrocinador"] as const).map((r) => {
            const f = fecha(acta?.[`firma_${r}`]);
            const puede = r === "gerente" ? permisos.gerente : permisos.patrocinador || permisos.admin;
            return (
              <div key={r} className="rounded-card border border-soil-border p-4">
                <p className="text-sm font-medium text-leaf-900">{r === "gerente" ? "Gerente del proyecto" : "Patrocinador"}</p>
                <p className="mt-1 text-sm text-muted">{f ? `Firmada el ${f}` : "Sin firmar"}</p>
                {!f && puede && acta && (
                  <form action={firmarActa.bind(null, id, r)} className="mt-3">
                    <BotonEnviar className={claseBoton.secundario} textoEnviando="Firmando…">Firmar</BotonEnviar>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-8" aria-labelledby="t-acta">
        <h2 id="t-acta" className="font-display text-2xl font-bold text-leaf-700">Acta</h2>
        {permisos.gestionar ? (
          <div className="mt-3"><FormularioActa accion={guardarActa.bind(null, id)} iniciales={iniciales} /></div>
        ) : acta ? (
          <dl className="mt-3 grid gap-4">
            {([["proposito", "Propósito y justificación"], ["objetivo_smart", "Objetivo SMART"], ["beneficios", "Beneficios esperados"], ["alcance_incluido", "Alcance incluido"], ["alcance_excluido", "Alcance excluido"], ["supuestos", "Supuestos"], ["restricciones", "Restricciones"], ["fuente_financiamiento", "Fuente de financiamiento"], ["contratistas_externos", "Contratistas externos"]] as [string, string][]).map(([k, t]) => (
              <div key={k}><dt className="text-xs font-medium uppercase tracking-wider text-leaf-800">{t}</dt><dd className="mt-0.5 whitespace-pre-wrap">{(acta[k] as string) || "—"}</dd></div>
            ))}
          </dl>
        ) : (
          <p className="mt-3 rounded-card bg-leaf-50 p-5 text-sm text-muted">El gerente aún no ha diligenciado el acta.</p>
        )}
      </section>
    </>
  );
}

export default function PaginaActa({ params, searchParams }: PageProps<"/proyectos/[id]/acta">) {
  return <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><Contenido params={params} searchParams={searchParams} /></Suspense>;
}
