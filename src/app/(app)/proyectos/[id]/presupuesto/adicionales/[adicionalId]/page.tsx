import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ES_UUID } from "@/lib/formato";
import { cargarContexto } from "@/lib/presupuesto/contexto";
import { desdeJson, formatearDecimal } from "@/lib/presupuesto/dinero";
import { Titulo } from "@/components/ui";
import { borrarAdicional, guardarAdicional } from "../../acciones";
import { FormularioBorrar } from "../../_formularios/formulario-borrar";
import { FormularioAdicional } from "../formulario-adicional";
import { cargarOpcionesAdicional } from "../opciones";

async function Contenido({ params }: { params: Promise<{ id: string; adicionalId: string }> }) {
  const { id, adicionalId } = await params;
  if (!ES_UUID.test(adicionalId)) notFound();
  const { supabase, proyecto } = await cargarContexto(id, "editar");
  const { data } = await supabase
    .from("adicionales")
    .select("id, codigo, descripcion, origen, valor_directo, aplica_indirectos, wbs_id, cambio_id, nota")
    .eq("proyecto_id", id).eq("id", adicionalId).maybeSingle();
  if (!data) notFound();
  const a = data as { codigo: string; descripcion: string; origen: string; valor_directo: number | string; aplica_indirectos: boolean; wbs_id: string | null; cambio_id: string | null; nota: string | null };
  const { elementos, cambios } = await cargarOpcionesAdicional(supabase, id);
  const inicial = {
    descripcion: a.descripcion, origen: a.origen, valor: formatearDecimal(desdeJson(a.valor_directo, 2), 2, 2),
    aplica_indirectos: a.aplica_indirectos ? "on" : "", wbs: a.wbs_id ?? "", cambio: a.cambio_id ?? "", nota: a.nota ?? "",
  };
  return (
    <>
      <Link href={`/proyectos/${id}/presupuesto/adicionales`} className="text-sm font-medium text-leaf-600 hover:underline">← Volver a adicionales</Link>
      <div className="mt-4"><Titulo>Editar adicional {a.codigo}</Titulo></div>
      <p className="mt-3 text-sm text-muted">{proyecto.nombre}</p>
      <div className="mt-6">
        <FormularioAdicional accion={guardarAdicional.bind(null, id, adicionalId)} elementos={elementos} cambios={cambios} inicial={inicial} textoBoton="Guardar cambios" volver={`/proyectos/${id}/presupuesto/adicionales`} />
      </div>
      <section className="mt-12 max-w-xl rounded-card border border-danger/30 bg-red-50 p-5" aria-labelledby="borrar">
        <h2 id="borrar" className="font-display text-xl font-bold text-danger">Borrar este adicional</h2>
        <div className="mt-3">
          <FormularioBorrar accion={borrarAdicional.bind(null, id, adicionalId)} textoBoton="Borrar adicional" ayuda="Si algún contrato tiene valor asignado a este adicional, primero quita esa asignación." />
        </div>
      </section>
    </>
  );
}

export default function PaginaEditarAdicional({ params }: PageProps<"/proyectos/[id]/presupuesto/adicionales/[adicionalId]">) {
  return <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><Contenido params={params} /></Suspense>;
}
