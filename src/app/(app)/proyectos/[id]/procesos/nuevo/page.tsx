import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { Titulo } from "@/components/ui";
import { guardarProceso } from "../acciones";
import { FormularioProceso } from "../formularios";

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { permisos } = await cargarProyecto(id);
  if (!permisos.gestionar) redirect(`/proyectos/${id}/procesos`);
  return (
    <>
      <Link href={`/proyectos/${id}/procesos`} className="text-sm font-medium text-leaf-600 hover:underline">← Volver a los procesos</Link>
      <div className="mt-4"><Titulo>Registrar proceso de contratación</Titulo></div>
      <div className="mt-6"><FormularioProceso accion={guardarProceso.bind(null, id, null)} iniciales={{}} volverA={`/proyectos/${id}/procesos`} /></div>
    </>
  );
}

export default function PaginaNuevoProceso({ params }: PageProps<"/proyectos/[id]/procesos/nuevo">) {
  return <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><Contenido params={params} /></Suspense>;
}
