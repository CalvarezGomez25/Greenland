import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirAdministrador } from "@/lib/sesion";
import { ES_UUID } from "@/lib/formato";
import { Titulo } from "@/components/ui";
import { FormularioProyecto } from "../../nuevo/formulario-proyecto";
import { editarProyecto } from "./acciones";

async function ContenidoEditar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ES_UUID.test(id)) notFound();
  const { supabase } = await exigirAdministrador(); // quien no sea administrador vuelve al inicio

  const { data: p } = await supabase
    .from("proyectos")
    .select("nombre, cliente, ubicacion, fecha_inicio, duracion_meses")
    .eq("id", id)
    .maybeSingle();
  if (!p) notFound();

  return (
    <>
      <Link href={`/proyectos/${id}`} className="text-sm font-medium text-leaf-600 hover:underline">
        ← Volver al proyecto
      </Link>
      <div className="mt-4">
        <Titulo>Editar proyecto</Titulo>
      </div>
      <div className="mt-6">
        <FormularioProyecto
          inicial={p}
          accionServidor={editarProyecto.bind(null, id)}
          textoBoton="Guardar cambios"
          textoEnviando="Guardando…"
          volverA={`/proyectos/${id}`}
        />
      </div>
    </>
  );
}

export default function PaginaEditarProyecto({ params }: PageProps<"/proyectos/[id]/editar">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}>
      <ContenidoEditar params={params} />
    </Suspense>
  );
}
