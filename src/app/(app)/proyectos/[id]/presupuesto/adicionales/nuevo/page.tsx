import { Suspense } from "react";
import Link from "next/link";
import { cargarContexto } from "@/lib/presupuesto/contexto";
import { Titulo } from "@/components/ui";
import { guardarAdicional } from "../../acciones";
import { FormularioAdicional } from "../formulario-adicional";
import { cargarOpcionesAdicional } from "../opciones";

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, proyecto } = await cargarContexto(id, "editar");
  const { elementos, cambios } = await cargarOpcionesAdicional(supabase, id);
  return (
    <>
      <Link href={`/proyectos/${id}/presupuesto/adicionales`} className="text-sm font-medium text-leaf-600 hover:underline">← Volver a adicionales</Link>
      <div className="mt-4"><Titulo>Registrar adicional de obra</Titulo></div>
      <p className="mt-3 text-sm text-muted">{proyecto.nombre}</p>
      <div className="mt-6">
        <FormularioAdicional accion={guardarAdicional.bind(null, id, null)} elementos={elementos} cambios={cambios} textoBoton="Registrar adicional" volver={`/proyectos/${id}/presupuesto/adicionales`} />
      </div>
    </>
  );
}

export default function PaginaNuevoAdicional({ params }: PageProps<"/proyectos/[id]/presupuesto/adicionales/nuevo">) {
  return <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><Contenido params={params} /></Suspense>;
}
