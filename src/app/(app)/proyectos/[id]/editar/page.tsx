import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/sesion";
import { ES_UUID } from "@/lib/formato";
import { Titulo } from "@/components/ui";
import { FormularioProyecto } from "../../nuevo/formulario-proyecto";
import { editarProyecto } from "./acciones";

async function ContenidoEditar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ES_UUID.test(id)) notFound();
  const { supabase, perfil } = await obtenerSesion();
  if (!perfil) redirect("/ingreso");

  const { data: p } = await supabase
    .from("proyectos")
    .select("nombre, cliente, ubicacion, fecha_inicio, duracion_meses")
    .eq("id", id)
    .maybeSingle();
  if (!p) notFound();

  // Solo Administrador o Gerente de este proyecto (la base de datos lo vuelve a verificar al guardar).
  let puede = perfil.rol_global === "administrador";
  if (!puede) {
    const { data: m } = await supabase
      .from("miembros_proyecto")
      .select("rol")
      .eq("proyecto_id", id)
      .eq("usuario_id", perfil.id)
      .maybeSingle();
    puede = m?.rol === "gerente";
  }
  if (!puede) redirect(`/proyectos/${id}`);

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
