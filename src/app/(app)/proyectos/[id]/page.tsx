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
import { numeroParametro } from "@/lib/pmo/parametros";
import { CORTES_RIESGO } from "@/lib/pmo/planificacion";
import { armarPortafolio, requiereDecision, type FilaPortafolio } from "@/lib/pmo/portafolio";
import { modulosVisibles, type Modulo } from "@/lib/modulos";
import { diasDesde } from "@/lib/pmo/cambios";
import { resumenBitacora, type EntradaResumen, type ResumenBitacora } from "@/lib/obra/bitacora";
import { BotonesExportar } from "@/components/botones-exportar";
import { GraficoAvance } from "@/components/grafico-avance";
import { ResumenControl } from "@/components/resumen-control";
import { rutaDelTablero } from "@/lib/navegacion";
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
  let decisiones: string[] = [];
  let riesgos = { activos: 0, criticos: 0 };
  if (!permisos.interventor) {
    const datos = await cargarDatosPortafolio(supabase);
    const base = datos.proyectos.find((x) => x.id === id);
    if (base) {
      const r = armarPortafolio({ ...datos.entrada, proyectos: [base] });
      resumen = r.filas[0] ?? null;
      if (resumen) decisiones = requiereDecision([resumen], datos.parametros).map((x) => x.tipo);
      const { data: rs } = await supabase.from("riesgos").select("score").eq("proyecto_id", id).eq("estado", "activo");
      const minCritico = numeroParametro(datos.parametros, "riesgo_critico_min", { proyectoId: id, portafolioId: base.portafolio_id }, CORTES_RIESGO.critico);
      const scores = ((rs ?? []) as { score: number }[]).map((x) => x.score);
      riesgos = { activos: scores.length, criticos: scores.filter((x) => x >= minCritico).length };
    }
  }
  // La bitácora alimenta el nivel N1: horas perdidas, retrasos e incidentes.
  let bit: ResumenBitacora | null = null;
  if (p.usa_obra) {
    const { data: bs } = await supabase.from("bitacoras").select("fecha, es_interventoria, horas_perdidas_total, retraso_causa, incidente_tipo").eq("proyecto_id", id).limit(2000);
    if (bs && bs.length > 0) bit = resumenBitacora(bs as EntradaResumen[]);
  }
  // Interventoría: actas y cambios esperando concepto (con su antigüedad) y hallazgos.
  let pendientes: { texto: string; href: string }[] = [];
  let hall: { abiertos: number; escalados: number } | null = null;
  if (p.usa_obra) {
    await supabase.rpc("hallazgos_escalar", { p_proyecto: id });
    const dias = (iso: string) => diasDesde(iso) ?? 0;
    const [{ data: ac }, { data: cm }, { data: hs }, { data: cs }] = await Promise.all([
      supabase.from("actas_pago").select("id, numero, creado_en, contrato_id").eq("proyecto_id", id).in("estado", ["radicada", "en_revision_interventoria"]),
      supabase.from("cambios").select("id, codigo, creado_en, contrato_id").eq("proyecto_id", id).eq("estado_flujo", "evaluacion_tecnica_financiera").not("contrato_id", "is", null),
      supabase.from("hallazgos").select("estado").eq("proyecto_id", id).neq("estado", "cerrado"),
      supabase.from("conceptos_interventoria").select("entidad_id, tipo").eq("proyecto_id", id).in("tipo", ["acta_pago", "cambio"]),
    ]);
    const conConcepto = new Set(((cs ?? []) as { entidad_id: string }[]).map((c) => c.entidad_id));
    pendientes = [
      ...((ac ?? []) as { id: string; numero: number; creado_en: string }[]).filter((a) => !conConcepto.has(a.id)).map((a) => ({ texto: `Acta de pago ${a.numero} sin concepto de interventoría · ${dias(a.creado_en)} día(s)`, href: `/proyectos/${id}/contratos` })),
      ...((cm ?? []) as { id: string; codigo: string; creado_en: string }[]).filter((c) => !conConcepto.has(c.id)).map((c) => ({ texto: `Cambio ${c.codigo} sin concepto de interventoría · ${dias(c.creado_en)} día(s)`, href: `/proyectos/${id}/cambios/${c.id}` })),
    ];
    const lista = (hs ?? []) as { estado: string }[];
    if (lista.length > 0) hall = { abiertos: lista.length, escalados: lista.filter((h) => h.estado === "escalado").length };
  }
  const modulos = modulosVisibles(permisos, p.usa_obra);
  const areas: [Modulo["area"], string][] = [["gestion", "Gestión del proyecto"], ["obra", "Obra"], ["interventoria", "Interventoría"]];

  return (
    <>
      <Link href={permisos.interventor ? "/mi-trabajo" : rutaDelTablero(permisos.rolGlobal)} className="text-sm font-medium text-leaf-600 hover:underline">
        ← {permisos.interventor ? "Volver a Mi trabajo" : permisos.rolGlobal ? "Volver al portafolio" : "Volver al tablero de mis proyectos"}
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Titulo>{p.nombre}</Titulo>
          <p className="mt-2 text-sm text-muted">{p.codigo} · {ETIQUETA_TIPO[p.tipo]} · {ETIQUETA_FASE[p.fase]} · {ETIQUETA_ESTADO[p.estado]}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {!permisos.interventor && <BotonesExportar base={`/proyectos/${p.id}/exportar/informe`} titulo="Informe gerencial" />}
          {permisos.gestionar && (
            <Link href={`/proyectos/${p.id}/editar`} className={claseBoton.contorno}>
              Editar proyecto
            </Link>
          )}
        </div>
      </div>

      <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 rounded-card bg-leaf-50 px-5 py-3 text-sm" aria-label="Datos del proyecto">
        <Dato etiqueta="Cliente" valor={p.cliente} />
        <Dato etiqueta="Ubicación" valor={p.ubicacion} />
        <Dato etiqueta="Inicio" valor={formatearFecha(p.fecha_inicio)} />
        <Dato etiqueta="Duración" valor={`${p.duracion_meses} ${p.duracion_meses === 1 ? "mes" : "meses"}`} />
        {p.moneda !== "COP" && <Dato etiqueta="Moneda" valor={p.moneda} />}
      </dl>

      {resumen && (
        <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,340px)_1fr]" aria-label="Estado del proyecto">
          <GraficoAvance fisico={resumen.evm?.avanceFisico ?? null} financiero={resumen.evm?.avanceFinanciero ?? null} planificado={resumen.evm?.avancePlan ?? null} href={`/proyectos/${p.id}/evm`} />
          <ResumenControl id={p.id} resumen={resumen} riesgos={riesgos} decisiones={decisiones} hrefTablero={rutaDelTablero(permisos.rolGlobal)} />
        </section>
      )}

      {bit && (
        <Link href={`/proyectos/${p.id}/bitacora`} className="mt-4 block rounded-card border border-soil-border p-4 text-sm hover:shadow-card" aria-label="Resumen de la bitácora">
          <strong className="text-leaf-700">Bitácora de obra:</strong> {bit.entradas} entrada(s) · {bit.horasPerdidas.toLocaleString("es-CO")} h perdidas · {bit.retrasos} retraso(s) · {bit.incidentes} incidente(s){bit.accidentes ? ` (${bit.accidentes} accidente(s))` : ""}{bit.ultimaFecha ? ` · última: ${formatearFecha(bit.ultimaFecha)}` : ""}
        </Link>
      )}

      {(pendientes.length > 0 || hall) && (
        <section className="mt-4 rounded-card border border-soil-border p-4 text-sm" aria-label="Interventoría">
          {hall && <p><Link href={`/proyectos/${p.id}/interventoria/hallazgos`} className="font-medium text-leaf-700 hover:underline">Hallazgos de interventoría:</Link> {hall.abiertos} sin cerrar{hall.escalados ? ` (${hall.escalados} escalado(s))` : ""}. <span className="text-muted">No cambian el semáforo; se muestran aparte.</span></p>}
          {pendientes.map((x) => <p key={x.texto} className="mt-1"><Link href={x.href} className="text-leaf-700 hover:underline">{x.texto}</Link></p>)}
        </section>
      )}

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
    <div className="flex items-baseline gap-1.5">
      <dt className="text-xs font-medium uppercase tracking-wider text-leaf-800">{etiqueta}</dt>
      <dd className="text-leaf-900">{valor || "—"}</dd>
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
