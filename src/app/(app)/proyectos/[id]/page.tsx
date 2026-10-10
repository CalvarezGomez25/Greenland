import { Suspense } from "react";
import Link from "next/link";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { formatearFecha } from "@/lib/formato";
import {
  ETIQUETA_ESTADO,
  ETIQUETA_FASE,
  ETIQUETA_ROL_PROYECTO,
  ETIQUETA_TIPO,
  ROLES_PROYECTO,
  type Miembro,
} from "@/lib/tipos";
import { cargarDatosPortafolio } from "@/lib/pmo/cargar";
import { armarPortafolio, type FilaPortafolio } from "@/lib/pmo/portafolio";
import { indice, porcentaje } from "@/lib/pmo/formato";
import { modulosVisibles, type Modulo } from "@/lib/modulos";
import { Semaforo } from "@/components/semaforo";
import { Selector, Titulo, claseBoton } from "@/components/ui";
import { BotonEnviar } from "@/components/boton-enviar";
import { cambiarRol, quitarMiembro } from "./acciones";
import { FormularioAsignar } from "./formulario-asignar";

async function DetalleProyecto({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, proyecto: p, permisos } = await cargarProyecto(id);
  const esAdmin = permisos.admin;

  const { data: filas } = await supabase
    .from("miembros_proyecto")
    .select("proyecto_id, usuario_id, rol, perfiles(nombre, correo)")
    .eq("proyecto_id", id)
    .order("creado_en");
  const miembros = (filas ?? []) as unknown as Miembro[];

  let candidatos: { id: string; nombre: string; correo: string | null }[] = [];
  if (esAdmin) {
    const { data: todos } = await supabase.from("perfiles").select("id, nombre, correo").order("nombre");
    const yaAsignados = new Set(miembros.map((m) => m.usuario_id));
    candidatos = ((todos ?? []) as typeof candidatos).filter((c) => !yaAsignados.has(c.id));
  }

  // Resumen de desempeño (semáforo e indicadores) — no aplica a la interventoría (acceso reducido).
  let resumen: FilaPortafolio | null = null;
  if (!permisos.interventor) {
    const datos = await cargarDatosPortafolio(supabase);
    const base = datos.proyectos.find((x) => x.id === id);
    if (base) {
      const r = armarPortafolio({ ...datos.entrada, proyectos: [base] });
      resumen = r.filas[0] ?? null;
    }
  }
  const modulos = modulosVisibles(permisos, p.usa_obra);
  const areas: [Modulo["area"], string][] = [["gestion", "Gestión del proyecto"], ["obra", "Obra"], ["interventoria", "Interventoría"]];

  return (
    <>
      <Link href="/" className="text-sm font-medium text-leaf-600 hover:underline">
        ← Volver al portafolio
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Titulo>{p.nombre}</Titulo>
          <p className="mt-2 text-sm text-muted">{p.codigo} · {ETIQUETA_TIPO[p.tipo]} · {ETIQUETA_FASE[p.fase]} · {ETIQUETA_ESTADO[p.estado]}</p>
        </div>
        {permisos.gestionar && (
          <Link href={`/proyectos/${p.id}/editar`} className={claseBoton.contorno}>
            Editar proyecto
          </Link>
        )}
      </div>

      {resumen && (
        <section className="mt-6" aria-label="Estado del proyecto">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-card bg-leaf-100 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-leaf-800">Estado calculado</p>
              <div className="mt-2"><Semaforo color={resumen.semaforo.general} /></div>
              {resumen.reporte && <p className="mt-2 text-xs text-muted">Reportado por el gerente: {resumen.reporte.estado_reportado}</p>}
            </div>
            <Link href={`/proyectos/${p.id}/evm`} className="rounded-card bg-leaf-100 p-4 hover:shadow-card"><p className="text-xs font-medium uppercase tracking-wider text-leaf-800">SPI</p><p className="mt-1 font-display text-2xl font-bold text-leaf-700">{indice(resumen.evm?.spi ?? null)}</p></Link>
            <Link href={`/proyectos/${p.id}/evm`} className="rounded-card bg-leaf-100 p-4 hover:shadow-card"><p className="text-xs font-medium uppercase tracking-wider text-leaf-800">CPI</p><p className="mt-1 font-display text-2xl font-bold text-leaf-700">{indice(resumen.evm?.cpi ?? null)}</p></Link>
            <Link href={`/proyectos/${p.id}/evm`} className="rounded-card bg-leaf-100 p-4 hover:shadow-card"><p className="text-xs font-medium uppercase tracking-wider text-leaf-800">Avance físico / financiero</p><p className="mt-1 font-display text-2xl font-bold text-leaf-700">{porcentaje(resumen.evm?.avanceFisico ?? null)} / {porcentaje(resumen.evm?.avanceFinanciero ?? null)}</p></Link>
          </div>
          {!resumen.medicion && <p className="mt-2 text-sm text-muted">Aún no hay mediciones de valor ganado. Se registran en “Valor ganado (EVM)”.</p>}
        </section>
      )}

      <dl className="mt-6 grid gap-4 rounded-card bg-leaf-100 p-5 sm:grid-cols-2">
        <Dato etiqueta="Cliente" valor={p.cliente} />
        <Dato etiqueta="Ubicación" valor={p.ubicacion} />
        <Dato etiqueta="Fecha de inicio" valor={formatearFecha(p.fecha_inicio)} />
        <Dato
          etiqueta="Duración"
          valor={`${p.duracion_meses} ${p.duracion_meses === 1 ? "mes" : "meses"}`}
        />
        <Dato etiqueta="Moneda" valor={p.moneda} />
        <Dato etiqueta="Área de Obra" valor={p.usa_obra ? "Sí" : "No"} />
      </dl>

      {areas.map(([area, titulo]) => {
        const lista = modulos.filter((m) => m.area === area);
        if (lista.length === 0) return null;
        return (
          <section key={area} className="mt-8" aria-label={titulo}>
            <h2 className="font-display text-2xl font-bold text-leaf-700">{titulo}</h2>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {lista.map((m) => (
                <li key={m.clave}>
                  <Link href={`/proyectos/${p.id}/${m.ruta}`} className="block h-full rounded-card border border-soil-border p-4 transition hover:-translate-y-0.5 hover:shadow-card">
                    <p className="font-display text-lg font-bold text-leaf-700">{m.titulo}</p>
                    <p className="text-sm text-muted">{m.descripcion}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

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
