import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { Titulo } from "@/components/ui";
import { crearCambio } from "../acciones";
import { cargarOpcionesCambio } from "../datos";
import { FormularioCambio } from "../formulario-cambio";

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, proyecto, permisos } = await cargarProyecto(id);
  if (!permisos.gestionar) redirect(`/proyectos/${id}/cambios`);
  const { tipos, riesgos, contratos } = await cargarOpcionesCambio(supabase, id, proyecto.portafolio_id);
  return (
    <>
      <Link href={`/proyectos/${id}/cambios`} className="text-sm font-medium text-leaf-600 hover:underline">← Volver a los cambios</Link>
      <div className="mt-4"><Titulo>Registrar cambio</Titulo></div>
      <p className="mt-3 text-sm text-muted">El nivel (Menor, Moderado o Crítico) lo calcula la plataforma según el impacto en costo frente al BAC del proyecto o al valor del contrato.</p>
      <div className="mt-6"><FormularioCambio accion={crearCambio.bind(null, id)} iniciales={{}} tipos={tipos} riesgos={riesgos} contratos={contratos} volverA={`/proyectos/${id}/cambios`} /></div>
    </>
  );
}

export default function PaginaNuevoCambio({ params }: PageProps<"/proyectos/[id]/cambios/nuevo">) {
  return <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><Contenido params={params} /></Suspense>;
}
