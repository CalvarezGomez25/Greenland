import { Suspense } from "react";
import { exigirAdministrador } from "@/lib/sesion";
import { Titulo } from "@/components/ui";
import { FormularioProyecto } from "./formulario-proyecto";

async function ContenidoNuevo() {
  const { supabase } = await exigirAdministrador(); // quien no sea administrador vuelve al inicio
  const [{ data: orgs }, { data: ports }] = await Promise.all([
    supabase.from("organizaciones").select("id, nombre").order("nombre"),
    supabase.from("portafolios").select("id, nombre, organizacion_id").order("nombre"),
  ]);
  return (
    <>
      <Titulo>Nuevo proyecto</Titulo>
      <div className="mt-6">
        <FormularioProyecto
          ficha={{
            organizaciones: (orgs ?? []) as { id: string; nombre: string }[],
            portafolios: (ports ?? []) as { id: string; nombre: string; organizacion_id: string }[],
            esAdmin: true,
          }}
        />
      </div>
    </>
  );
}

export default function PaginaNuevoProyecto() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}>
      <ContenidoNuevo />
    </Suspense>
  );
}
