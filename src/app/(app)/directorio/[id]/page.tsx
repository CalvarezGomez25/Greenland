import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/sesion";
import { ES_UUID } from "@/lib/formato";
import { Titulo } from "@/components/ui";
import { BotonBorrar } from "../../proyectos/[id]/r/boton-borrar";
import { FormularioContacto } from "../formulario-contacto";
import { borrarContacto, guardarContacto } from "../acciones";

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const nuevo = id === "nuevo";
  if (!nuevo && !ES_UUID.test(id)) notFound();
  const { supabase, perfil } = await obtenerSesion();
  const { data: permitido } = await supabase.rpc("puede_usar_directorio");
  if (permitido !== true) redirect("/");

  const iniciales: Record<string, string> = {};
  if (!nuevo) {
    const { data } = await supabase.from("contactos").select("nombre, rol, correo, telefono").eq("id", id).maybeSingle();
    if (!data) notFound();
    for (const [k, x] of Object.entries(data as Record<string, string | null>)) iniciales[k] = x ?? "";
  }

  return (
    <>
      <Link href="/directorio" className="text-sm font-medium text-leaf-600 hover:underline">← Volver al directorio</Link>
      <div className="mt-4"><Titulo>{nuevo ? "Agregar contacto" : "Editar contacto"}</Titulo></div>
      {!nuevo && (
        <p className="mt-3 max-w-xl text-sm text-muted">
          Cambiar los datos aquí actualiza el directorio para los próximos proyectos. Los interesados ya registrados en cada proyecto conservan los datos que tienen.
        </p>
      )}
      <div className="mt-6">
        <FormularioContacto accion={guardarContacto.bind(null, nuevo ? null : id)} iniciales={iniciales} />
      </div>
      {!nuevo && perfil?.rol_global === "administrador" && (
        <div className="mt-8 border-t border-soil-border pt-6">
          <p className="mb-3 max-w-xl text-sm text-muted">Al eliminarlo, los interesados que lo usan se conservan; solo pierden el vínculo con el directorio.</p>
          <BotonBorrar accion={borrarContacto.bind(null, id)} texto="este contacto" />
        </div>
      )}
    </>
  );
}

export default function PaginaContacto({ params }: PageProps<"/directorio/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}>
      <Contenido params={params} />
    </Suspense>
  );
}
