import { Suspense } from "react";
import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/sesion";
import { esSoloInterventoria, rutaDelTablero } from "@/lib/navegacion";
import type { RolProyecto } from "@/lib/tipos";
import { Dashboard } from "../_tablero/tablero";

export const metadata = { title: "Tablero de mis proyectos · PMO360" };

// Tablero de control limitado a los proyectos de quien no ve todo el portafolio. Quien sí lo ve usa el tablero de «/»;
// la interventoría no tiene tablero de control.
async function TableroPropio({ searchParams }: { searchParams: PageProps<"/tablero">["searchParams"] }) {
  const { supabase, perfil } = await obtenerSesion();
  if (perfil && rutaDelTablero(perfil.rol_global) === "/") redirect("/");
  if (perfil) {
    const { data } = await supabase.from("miembros_proyecto").select("rol").eq("usuario_id", perfil.id);
    // la interventoría no entra por el tablero de control: su inicio es «Mi trabajo»
    if (esSoloInterventoria(perfil.rol_global, ((data ?? []) as { rol: RolProyecto }[]).map((m) => m.rol))) redirect("/mi-trabajo");
  }
  return <Dashboard searchParams={searchParams} base="/tablero" />;
}

export default function PaginaTableroPropio({ searchParams }: PageProps<"/tablero">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Cargando el tablero…</p>}>
      <TableroPropio searchParams={searchParams} />
    </Suspense>
  );
}
