import { Suspense } from "react";
import Link from "next/link";
import { obtenerSesion } from "@/lib/sesion";
import { formatearFecha } from "@/lib/formato";
import {
  ETIQUETA_ROL_PROYECTO,
  type Proyecto,
  type RolProyecto,
} from "@/lib/tipos";
import { Aviso, Titulo, claseBoton } from "@/components/ui";

async function ListaProyectos() {
  const { supabase, perfil } = await obtenerSesion();
  if (!perfil) {
    return (
      <Aviso>
        Tu cuenta aún no tiene perfil en la plataforma. Avisa al administrador.
      </Aviso>
    );
  }

  const [{ data: proyectos, error }, { data: mias }] = await Promise.all([
    supabase
      .from("proyectos")
      .select("id, nombre, cliente, ubicacion, fecha_inicio, duracion_meses, moneda")
      .order("fecha_inicio", { ascending: false }),
    supabase
      .from("miembros_proyecto")
      .select("proyecto_id, rol")
      .eq("usuario_id", perfil.id),
  ]);

  if (error) return <Aviso>No se pudieron cargar los proyectos. Intenta de nuevo.</Aviso>;

  const rolEn = new Map<string, RolProyecto>(
    ((mias ?? []) as { proyecto_id: string; rol: RolProyecto }[]).map((m) => [
      m.proyecto_id,
      m.rol,
    ]),
  );
  const lista = (proyectos ?? []) as Proyecto[];
  const esAdmin = perfil.rol_global === "administrador";

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Titulo>Proyectos</Titulo>
          <p className="mt-3 text-sm text-muted">
            {perfil.rol_global
              ? "Ves todos los proyectos de la plataforma."
              : "Ves los proyectos en los que estás asignado."}
          </p>
        </div>
        {esAdmin && (
          <Link href="/proyectos/nuevo" className={claseBoton.primario}>
            Nuevo proyecto
          </Link>
        )}
      </div>

      {lista.length === 0 ? (
        <div className="rounded-card bg-leaf-50 p-8 text-center text-sm text-muted">
          {esAdmin
            ? "Aún no hay proyectos. Crea el primero con el botón “Nuevo proyecto”."
            : "Todavía no tienes proyectos asignados. Pide al administrador que te agregue a uno."}
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {lista.map((p) => {
            const rol = rolEn.get(p.id);
            return (
              <li key={p.id}>
                <Link
                  href={`/proyectos/${p.id}`}
                  className="block h-full rounded-card bg-leaf-100 p-5 transition hover:-translate-y-0.5 hover:shadow-card"
                >
                  <h2 className="font-display text-xl font-bold text-leaf-700">{p.nombre}</h2>
                  {(p.cliente || p.ubicacion) && (
                    <p className="mt-1 text-sm">
                      {[p.cliente, p.ubicacion].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  <p className="mt-3 text-sm text-muted">
                    Inicio: {formatearFecha(p.fecha_inicio)} · {p.duracion_meses}{" "}
                    {p.duracion_meses === 1 ? "mes" : "meses"} · {p.moneda}
                  </p>
                  {rol && (
                    <p className="mt-2 inline-block rounded-full bg-white px-3 py-0.5 text-xs font-medium text-leaf-800">
                      {ETIQUETA_ROL_PROYECTO[rol]}
                    </p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

export default function PaginaProyectos() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Cargando proyectos…</p>}>
      <ListaProyectos />
    </Suspense>
  );
}
