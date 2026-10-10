import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { hoyColombia } from "@/lib/pmo/cargar";
import { Titulo } from "@/components/ui";
import { guardarBitacora, prepararSubidas } from "../acciones";
import { FormularioBitacora } from "../formulario-bitacora";

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, permisos } = await cargarProyecto(id);
  if (!(permisos.gestionar || permisos.supervisor || permisos.interventor)) redirect(`/proyectos/${id}/bitacora`);
  const { data } = await supabase.from("tareas").select("id, nombre").eq("proyecto_id", id).order("orden").order("semana_inicio");
  return (
    <>
      <Link href={`/proyectos/${id}/bitacora`} className="text-sm font-medium text-leaf-600 hover:underline">← Volver a la bitácora</Link>
      <div className="mt-4"><Titulo>Nueva entrada</Titulo></div>
      <div className="mt-6">
        <FormularioBitacora proyectoId={id} hoy={hoyColombia()} tareas={(data ?? []) as { id: string; nombre: string }[]} esInterventoria={permisos.interventor} preparar={prepararSubidas} guardar={guardarBitacora} />
      </div>
    </>
  );
}

export default function PaginaNuevaBitacora({ params }: PageProps<"/proyectos/[id]/bitacora/nueva">) {
  return <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><Contenido params={params} /></Suspense>;
}
