import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { obtenerSesion } from "@/lib/sesion";
import { ES_UUID, formatearFecha } from "@/lib/formato";
import {
  ETIQUETA_ROL_PROYECTO,
  ROLES_PROYECTO,
  type Miembro,
  type Proyecto,
} from "@/lib/tipos";
import { Selector, Titulo, claseBoton } from "@/components/ui";
import { BotonEnviar } from "@/components/boton-enviar";
import { cambiarRol, quitarMiembro } from "./acciones";
import { FormularioAsignar } from "./formulario-asignar";

async function DetalleProyecto({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ES_UUID.test(id)) notFound();

  const { supabase, perfil } = await obtenerSesion();
  const esAdmin = perfil?.rol_global === "administrador";

  // Si la persona no tiene acceso, la base de datos no devuelve la fila: 404.
  const { data: proyecto } = await supabase
    .from("proyectos")
    .select("id, nombre, cliente, ubicacion, fecha_inicio, duracion_meses, moneda")
    .eq("id", id)
    .maybeSingle();
  if (!proyecto) notFound();
  const p = proyecto as Proyecto;

  const { data: filas } = await supabase
    .from("miembros_proyecto")
    .select("proyecto_id, usuario_id, rol, perfiles(nombre, correo)")
    .eq("proyecto_id", id)
    .order("creado_en");
  const miembros = (filas ?? []) as unknown as Miembro[];

  let candidatos: { id: string; nombre: string; correo: string | null }[] = [];
  if (esAdmin) {
    const { data: todos } = await supabase
      .from("perfiles")
      .select("id, nombre, correo")
      .order("nombre");
    const yaAsignados = new Set(miembros.map((m) => m.usuario_id));
    candidatos = ((todos ?? []) as typeof candidatos).filter((c) => !yaAsignados.has(c.id));
  }

  return (
    <>
      <Link href="/" className="text-sm font-medium text-leaf-600 hover:underline">
        ← Volver a proyectos
      </Link>

      <div className="mt-4">
        <Titulo>{p.nombre}</Titulo>
      </div>

      <dl className="mt-6 grid gap-4 rounded-card bg-leaf-100 p-5 sm:grid-cols-2">
        <Dato etiqueta="Cliente" valor={p.cliente} />
        <Dato etiqueta="Ubicación" valor={p.ubicacion} />
        <Dato etiqueta="Fecha de inicio" valor={formatearFecha(p.fecha_inicio)} />
        <Dato
          etiqueta="Duración"
          valor={`${p.duracion_meses} ${p.duracion_meses === 1 ? "mes" : "meses"}`}
        />
        <Dato etiqueta="Moneda" valor={p.moneda} />
      </dl>

      <section className="mt-10" aria-labelledby="titulo-miembros">
        <h2 id="titulo-miembros" className="font-display text-2xl font-bold text-leaf-700">
          Equipo del proyecto
        </h2>
        <p className="mt-1 text-sm text-muted">
          El Administrador y el Director general ven todos los proyectos y no necesitan
          asignación.
        </p>

        {miembros.length === 0 ? (
          <p className="mt-4 rounded-card bg-leaf-50 p-5 text-sm text-muted">
            Este proyecto aún no tiene personas asignadas.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-soil-border rounded-card border border-soil-border">
            {miembros.map((m) => (
              <li
                key={m.usuario_id}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div>
                  <p className="font-medium text-leaf-900">{m.perfiles?.nombre ?? "Sin nombre"}</p>
                  {m.perfiles?.correo && (
                    <p className="text-sm text-muted">{m.perfiles.correo}</p>
                  )}
                </div>
                {esAdmin ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <form
                      action={cambiarRol.bind(null, p.id, m.usuario_id)}
                      className="flex items-end gap-2"
                    >
                      <Selector etiqueta="Rol" name="rol" defaultValue={m.rol}>
                        {ROLES_PROYECTO.map((r) => (
                          <option key={r} value={r}>
                            {ETIQUETA_ROL_PROYECTO[r]}
                          </option>
                        ))}
                      </Selector>
                      <BotonEnviar className={claseBoton.secundario} textoEnviando="Guardando…">
                        Guardar
                      </BotonEnviar>
                    </form>
                    <form action={quitarMiembro.bind(null, p.id, m.usuario_id)}>
                      <BotonEnviar className={claseBoton.peligro} textoEnviando="Quitando…">
                        Quitar
                      </BotonEnviar>
                    </form>
                  </div>
                ) : (
                  <span className="rounded-full bg-leaf-100 px-3 py-0.5 text-xs font-medium text-leaf-800">
                    {ETIQUETA_ROL_PROYECTO[m.rol]}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        {esAdmin && (
          <div className="mt-6 rounded-card bg-leaf-50 p-5">
            <h3 className="mb-3 font-display text-lg font-bold text-leaf-700">
              Asignar una persona
            </h3>
            <FormularioAsignar proyectoId={p.id} candidatos={candidatos} />
          </div>
        )}
      </section>
    </>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-leaf-800">{etiqueta}</dt>
      <dd className="mt-0.5 text-leaf-900">{valor || "—"}</dd>
    </div>
  );
}

export default function PaginaProyecto({ params }: PageProps<"/proyectos/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Cargando proyecto…</p>}>
      <DetalleProyecto params={params} />
    </Suspense>
  );
}
