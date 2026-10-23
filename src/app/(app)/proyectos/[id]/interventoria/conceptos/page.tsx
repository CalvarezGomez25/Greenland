import { Suspense } from "react";
import Link from "next/link";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { formatearFechaHora } from "@/lib/formato";
import { RESULTADOS, SUBROLES, TIPOS_CONCEPTO, etiqueta } from "@/lib/interventoria";
import { Aviso, Titulo } from "@/components/ui";
import { AvisoResultado } from "@/components/aviso-resultado";
import { FormularioRegistro } from "../../r/formulario-registro";
import { cargarOpciones } from "../datos";
import { emitirConcepto } from "../acciones";
import type { CampoDef } from "@/lib/registros/tipos";

type C = { id: string; tipo: string; entidad_tipo: string; entidad_id: string; resultado: string; texto: string | null; autor_id: string; subrol: string; fecha: string };

async function Contenido({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  const { id } = await params;
  const { ok } = await searchParams;
  const { supabase, proyecto, permisos } = await cargarProyecto(id);
  const [o, { data, error }, { data: per }] = await Promise.all([
    cargarOpciones(supabase, id, proyecto.portafolio_id),
    supabase.from("conceptos_interventoria").select("id, tipo, entidad_tipo, entidad_id, resultado, texto, autor_id, subrol, fecha").eq("proyecto_id", id).order("fecha", { ascending: false }).limit(300),
    supabase.from("perfiles").select("id, nombre"),
  ]);
  const conceptos = (data ?? []) as C[];
  const nombres = new Map(((per ?? []) as { id: string; nombre: string }[]).map((p) => [p.id, p.nombre]));
  const registros = [
    ...o.actas.map((x) => ({ valor: `acta_pago|${x.valor}`, etiqueta: `Acta de pago: ${x.etiqueta}` })),
    ...o.cambios.map((x) => ({ valor: `cambio|${x.valor}`, etiqueta: `Cambio: ${x.etiqueta}` })),
    ...o.todosContratos.map((x) => ({ valor: `contrato|${x.valor}`, etiqueta: `Contrato: ${x.etiqueta}` })),
    ...o.tareas.map((x) => ({ valor: `tarea|${x.valor}`, etiqueta: `Tarea: ${x.etiqueta}` })),
    ...o.documentos.map((x) => ({ valor: `documento|${x.valor}`, etiqueta: `Documento: ${x.etiqueta}` })),
    { valor: `proyecto|${id}`, etiqueta: `Proyecto: ${proyecto.nombre}` },
  ];
  const etiquetaDe = new Map(registros.map((r) => [r.valor.split("|")[1], r.etiqueta]));
  const campos: CampoDef[] = [
    { nombre: "tipo", etiqueta: "Tipo de concepto", tipo: "seleccion", obligatorio: true, opciones: TIPOS_CONCEPTO.map(([valor, etiqueta]) => ({ valor, etiqueta })) },
    { nombre: "registro", etiqueta: "Registro al que se refiere", tipo: "seleccion", obligatorio: true, opcionesDe: "registros" },
    { nombre: "resultado", etiqueta: "Resultado", tipo: "seleccion", obligatorio: true, opciones: RESULTADOS.map(([valor, etiqueta]) => ({ valor, etiqueta })) },
    { nombre: "texto", etiqueta: "Texto del concepto", tipo: "area", ayuda: "Obligatorio si hay observaciones o no se aprueba. Un concepto emitido no se edita ni se borra: se corrige con uno nuevo." },
  ];

  return (
    <>
      <Link href={`/proyectos/${id}/interventoria`} className="text-sm font-medium text-leaf-600 hover:underline">← Interventoría</Link>
      <div className="mt-4"><Titulo>Conceptos de interventoría</Titulo></div>
      <p className="mt-3 max-w-3xl text-sm text-muted">Registro único de pronunciamientos. Cada concepto guarda autor, sub-rol y fecha. El concepto no aprueba ni rechaza: lo decide quien corresponda.</p>
      <div className="mt-4"><AvisoResultado ok={ok} /></div>
      {error && <div className="mt-4"><Aviso>No se pudieron leer los conceptos{error.code ? ` (código ${error.code})` : ""}.</Aviso></div>}
      {conceptos.length === 0 && !error ? <p className="mt-6 rounded-card bg-leaf-50 p-6 text-sm text-muted">Aún no hay conceptos.</p> : (
        <div className="mt-6 overflow-x-auto rounded-card border border-soil-border">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-leaf-100 text-xs uppercase tracking-wider text-leaf-800"><tr>{["Fecha", "Tipo", "Registro", "Resultado", "Autor", "Texto"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-soil-border">
              {conceptos.map((c) => (
                <tr key={c.id}>
                  <td className="whitespace-nowrap px-3 py-2">{formatearFechaHora(c.fecha)}</td><td className="px-3 py-2">{etiqueta(TIPOS_CONCEPTO, c.tipo)}</td>
                  <td className="px-3 py-2">{etiquetaDe.get(c.entidad_id) ?? c.entidad_tipo}</td><td className="px-3 py-2 font-medium">{etiqueta(RESULTADOS, c.resultado)}</td>
                  <td className="px-3 py-2">{nombres.get(c.autor_id) ?? "—"}<span className="block text-xs text-muted">{etiqueta(SUBROLES, c.subrol)}</span></td>
                  <td className="max-w-[320px] whitespace-pre-wrap px-3 py-2 text-muted">{c.texto ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {permisos.interventor && (
        <section className="mt-8 rounded-card bg-leaf-50 p-5"><h2 className="mb-3 font-display text-xl font-bold text-leaf-700">Emitir un concepto</h2>
          <FormularioRegistro accion={emitirConcepto.bind(null, id)} campos={campos} opciones={{ registros }} iniciales={{}} editando={false} volverA={`/proyectos/${id}/interventoria`} /></section>
      )}
    </>
  );
}

export default function PaginaConceptos({ params, searchParams }: PageProps<"/proyectos/[id]/interventoria/conceptos">) {
  return <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><Contenido params={params} searchParams={searchParams} /></Suspense>;
}
