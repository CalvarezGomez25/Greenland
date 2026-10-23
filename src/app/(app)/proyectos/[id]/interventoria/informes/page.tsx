import { Suspense } from "react";
import Link from "next/link";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { formatearFecha } from "@/lib/formato";
import { TIPOS_INFORME, etiqueta } from "@/lib/interventoria";
import { Aviso, Titulo } from "@/components/ui";
import { AvisoResultado } from "@/components/aviso-resultado";
import { FormularioRegistro } from "../../r/formulario-registro";
import { cargarOpciones } from "../datos";
import { crearInforme } from "../acciones";
import type { CampoDef } from "@/lib/registros/tipos";

type I = { id: string; tipo: string; periodo: string; estado: string; creado_en: string; contrato_id: string | null };

async function Contenido({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  const { id } = await params;
  const { ok } = await searchParams;
  const { supabase, proyecto, permisos } = await cargarProyecto(id);
  const [o, { data, error }, { data: als }] = await Promise.all([
    cargarOpciones(supabase, id, proyecto.portafolio_id),
    supabase.from("informes_interventoria").select("id, tipo, periodo, estado, creado_en, contrato_id").eq("proyecto_id", id).order("creado_en", { ascending: false }).limit(200),
    permisos.interventor ? supabase.from("interventoria_alcances").select("id, contrato_vigilado_id").eq("proyecto_id", id) : Promise.resolve({ data: [] }),
  ]);
  const informes = (data ?? []) as I[];
  const nomContrato = new Map(o.todosContratos.map((c) => [c.valor, c.etiqueta]));
  const alcOp = ((als ?? []) as { id: string; contrato_vigilado_id: string | null }[]).map((a) => ({ valor: a.id, etiqueta: a.contrato_vigilado_id ? `Vigila: ${nomContrato.get(a.contrato_vigilado_id) ?? "contrato"}` : "Sin contrato de obra" }));
  const campos: CampoDef[] = [
    { nombre: "alcance_id", etiqueta: "Asignación", tipo: "seleccion", obligatorio: true, opcionesDe: "alcances" },
    { nombre: "tipo", etiqueta: "Tipo de informe", tipo: "seleccion", obligatorio: true, opciones: TIPOS_INFORME.map(([valor, etiqueta]) => ({ valor, etiqueta })) },
    { nombre: "desde", etiqueta: "Periodo desde", tipo: "fecha", obligatorio: true },
    { nombre: "hasta", etiqueta: "Periodo hasta", tipo: "fecha", obligatorio: true },
    { nombre: "acta_id", etiqueta: "Acta de pago (informe periódico)", tipo: "seleccion", opcionesDe: "actas", ayuda: "Los datos del sistema (avance, financiero, hallazgos, conceptos) se prellenan solos." },
  ];
  return (
    <>
      <Link href={`/proyectos/${id}/interventoria`} className="text-sm font-medium text-leaf-600 hover:underline">← Interventoría</Link>
      <div className="mt-4"><Titulo>Informes de interventoría</Titulo></div>
      <p className="mt-3 max-w-3xl text-sm text-muted">Cuatro tipos: periódico (uno por cada pago), especial, para proceso sancionatorio y final. El director de interventoría firma y con la firma el informe queda fijo.</p>
      <div className="mt-4"><AvisoResultado ok={ok} /></div>
      {error && <div className="mt-4"><Aviso>No se pudieron leer los informes{error.code ? ` (código ${error.code})` : ""}.</Aviso></div>}
      {informes.length === 0 && !error ? <p className="mt-6 rounded-card bg-leaf-50 p-6 text-sm text-muted">Aún no hay informes.</p> : (
        <ul className="mt-6 divide-y divide-soil-border rounded-card border border-soil-border text-sm">
          {informes.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
              <span><Link href={`/proyectos/${id}/interventoria/informes/${i.id}`} className="font-medium text-leaf-700 hover:underline">{etiqueta(TIPOS_INFORME, i.tipo)}</Link> · {i.periodo}{i.contrato_id ? ` · ${nomContrato.get(i.contrato_id) ?? "contrato"}` : ""}</span>
              <span className="text-muted">{i.estado === "firmado" ? "Firmado" : "Borrador"} · creado el {formatearFecha(i.creado_en.slice(0, 10))}</span>
            </li>
          ))}
        </ul>
      )}
      {permisos.interventor && alcOp.length > 0 && (
        <section className="mt-8 rounded-card bg-leaf-50 p-5"><h2 className="mb-3 font-display text-xl font-bold text-leaf-700">Nuevo informe</h2>
          <FormularioRegistro accion={crearInforme.bind(null, id)} campos={campos} opciones={{ alcances: alcOp, actas: o.actas }} iniciales={{}} editando={false} volverA={`/proyectos/${id}/interventoria`} /></section>
      )}
    </>
  );
}

export default function PaginaInformes({ params, searchParams }: PageProps<"/proyectos/[id]/interventoria/informes">) {
  return <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><Contenido params={params} searchParams={searchParams} /></Suspense>;
}
