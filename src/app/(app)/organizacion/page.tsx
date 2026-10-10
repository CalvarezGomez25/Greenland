import { Suspense } from "react";
import { exigirAdministrador } from "@/lib/sesion";
import { Titulo } from "@/components/ui";
import { crearOrganizacion, crearPortafolio } from "./acciones";
import { FormularioOrganizacion, FormularioPortafolio } from "./formularios";

async function Contenido() {
  const { supabase } = await exigirAdministrador();
  const [{ data: orgs }, { data: ports }, { data: proys }] = await Promise.all([
    supabase.from("organizaciones").select("id, nombre, tipo").order("nombre"),
    supabase.from("portafolios").select("id, nombre, organizacion_id").order("nombre"),
    supabase.from("proyectos").select("portafolio_id"),
  ]);
  const organizaciones = (orgs ?? []) as { id: string; nombre: string; tipo: string }[];
  const portafolios = (ports ?? []) as { id: string; nombre: string; organizacion_id: string }[];
  const cuenta = new Map<string, number>();
  for (const p of (proys ?? []) as { portafolio_id: string | null }[]) if (p.portafolio_id) cuenta.set(p.portafolio_id, (cuenta.get(p.portafolio_id) ?? 0) + 1);

  return (
    <>
      <Titulo>Organizaciones y portafolios</Titulo>
      <p className="mt-3 max-w-3xl text-sm text-muted">Estructura para agrupar los proyectos. El portafolio de cada proyecto se elige al crearlo o desde su ficha.</p>
      <ul className="mt-6 flex flex-col gap-4">
        {organizaciones.map((o) => (
          <li key={o.id} className="rounded-card bg-leaf-100 p-5">
            <h2 className="font-display text-xl font-bold text-leaf-700">{o.nombre} <span className="text-sm font-normal text-muted">· {o.tipo}</span></h2>
            <ul className="mt-2 text-sm">
              {portafolios.filter((p) => p.organizacion_id === o.id).map((p) => (
                <li key={p.id}>{p.nombre} <span className="text-muted">· {cuenta.get(p.id) ?? 0} proyecto(s)</span></li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-card bg-leaf-50 p-5"><h3 className="mb-3 font-display text-lg font-bold text-leaf-700">Nueva organización</h3><FormularioOrganizacion accion={crearOrganizacion} /></div>
        <div className="rounded-card bg-leaf-50 p-5"><h3 className="mb-3 font-display text-lg font-bold text-leaf-700">Nuevo portafolio</h3><FormularioPortafolio accion={crearPortafolio} organizaciones={organizaciones} /></div>
      </div>
    </>
  );
}

export default function PaginaOrganizacion() {
  return <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><Contenido /></Suspense>;
}
