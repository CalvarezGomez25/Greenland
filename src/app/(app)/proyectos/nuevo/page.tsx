import { Suspense } from "react";
import { exigirAdministrador } from "@/lib/sesion";
import { Titulo } from "@/components/ui";
import { FormularioProyecto } from "./formulario-proyecto";

async function ContenidoNuevo() {
  await exigirAdministrador(); // quien no sea administrador vuelve al inicio
  return (
    <>
      <Titulo>Nuevo proyecto</Titulo>
      <div className="mt-6">
        <FormularioProyecto />
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
