import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { Titulo } from "@/components/ui";
import { crearContrato } from "../acciones";
import { FormularioContrato } from "../formularios";

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { permisos } = await cargarProyecto(id);
  if (!permisos.gestionar) redirect(`/proyectos/${id}/contratos`);
  return (
    <>
      <Link href={`/proyectos/${id}/contratos`} className="text-sm font-medium text-leaf-600 hover:underline">← Volver a los contratos</Link>
      <div className="mt-4"><Titulo>Registrar contrato</Titulo></div>
      <p className="mt-3 text-sm text-muted">El contrato de interventoría se registra aquí como cualquier otro; su valor puede entrar al presupuesto como un rubro.</p>
      <div className="mt-6"><FormularioContrato accion={crearContrato.bind(null, id)} iniciales={{}} volverA={`/proyectos/${id}/contratos`} /></div>
    </>
  );
}

export default function PaginaNuevoContrato({ params }: PageProps<"/proyectos/[id]/contratos/nuevo">) {
  return <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><Contenido params={params} /></Suspense>;
}
