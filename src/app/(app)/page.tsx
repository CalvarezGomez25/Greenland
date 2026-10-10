import { Suspense } from "react";
import Link from "next/link";
import { obtenerSesion } from "@/lib/sesion";
import { cargarDashboard } from "@/lib/pmo/dashboard";
import { TablaKpis } from "@/components/kpis";
import { centavos, indice, porcentaje } from "@/lib/pmo/formato";
import { ETIQUETA_ESTADO, ETIQUETA_FASE, type EstadoProyecto, type FaseProyecto } from "@/lib/tipos";
import { Semaforo } from "@/components/semaforo";
import { BotonesExportar } from "@/components/botones-exportar";
import { Ayuda } from "@/components/ayuda";
import { temaDe } from "@/lib/glosario";
import { Aviso, Titulo, claseBoton } from "@/components/ui";

type Filtros = { estado?: string; fase?: string; portafolio?: string; gerente?: string };
const NIVEL: Record<string, string> = { critico: "Crítico", alto: "Alto", medio: "Medio", bajo: "Bajo" };

async function Dashboard({ searchParams }: { searchParams: Promise<Filtros> }) {
  const f = await searchParams;
  const { supabase, perfil } = await obtenerSesion();
  if (!perfil) return <Aviso>Tu cuenta aún no tiene perfil en la plataforma. Avisa al administrador.</Aviso>;

  // Interventoría (sin rol global): no entra al tablero de control del portafolio; ve solo sus proyectos.
  if (!perfil.rol_global) {
    const { data: mias } = await supabase.from("miembros_proyecto").select("proyecto_id, rol").eq("usuario_id", perfil.id);
    const roles = (mias ?? []) as { proyecto_id: string; rol: string }[];
    if (roles.length > 0 && roles.every((m) => m.rol === "interventoria")) {
      const { data: ps } = await supabase.from("proyectos").select("id, nombre, codigo, cliente, ubicacion").order("nombre");
      const lista = (ps ?? []) as { id: string; nombre: string; codigo: string | null; cliente: string | null; ubicacion: string | null }[];
      return (
        <>
          <Titulo>Mis proyectos de interventoría</Titulo>
          <p className="mt-3 text-sm text-muted">Ves solo los contratos y la documentación que tienes asignados.</p>
          {lista.length === 0 ? <p className="mt-6 rounded-card bg-leaf-50 p-6 text-sm text-muted">Tu asignación aún no está vigente. Avisa al gerente del proyecto.</p> : (
            <ul className="mt-6 grid gap-4 sm:grid-cols-2">{lista.map((p) => <li key={p.id}><Link href={`/proyectos/${p.id}`} className="block h-full rounded-card bg-leaf-100 p-5 transition hover:-translate-y-0.5 hover:shadow-card"><h2 className="font-display text-xl font-bold text-leaf-700">{p.nombre}</h2><p className="mt-1 text-sm">{[p.codigo, p.cliente, p.ubicacion].filter(Boolean).join(" · ")}</p></Link></li>)}</ul>
          )}
        </>
      );
    }
  }

  const d = await cargarDashboard(supabase, f);
  if (!d) return <Aviso>No se pudieron cargar los proyectos. Intenta de nuevo.</Aviso>;
  const { filas, resumen, decisiones, kpis, portafolios, gerentes, nCerrados } = d;
  const esAdmin = perfil.rol_global === "administrador";
  const hayFiltro = Boolean(f.estado || f.fase || f.portafolio || f.gerente);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div>
          <h1 className="font-display text-2xl font-bold leading-tight text-leaf-500">Tablero de control</h1>
          <p className="text-sm text-muted">
            {perfil.rol_global ? "Todos los proyectos de la plataforma." : "Los proyectos en los que estás asignado."}
            {resumen.semana && ` Corte: semana ${resumen.semana.semana} de ${resumen.semana.anio} (${resumen.corte}).`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted">Exportar:</span>
          <BotonesExportar base={`/exportar/dashboard?${new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString()}`} />
          {esAdmin && <Link href="/proyectos/nuevo" className={`${claseBoton.primario} !h-9`}>Nuevo proyecto</Link>}
        </div>
      </div>

      <section aria-label="Resumen del portafolio" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Tarjeta titulo="Proyectos activos" valor={String(resumen.activos)} href="/?estado=activo#t-semaforo" />
        <Tarjeta titulo="Semáforo" valor={`${resumen.verdes} / ${resumen.amarillos} / ${resumen.rojos}`} nota={resumen.sinDatos ? `verde / amarillo / rojo · ${resumen.sinDatos} sin datos` : "verde / amarillo / rojo"} href="#t-semaforo" />
        <Tarjeta titulo="Presupuesto (BAC)" valor={centavos(resumen.bac)} nota="COP" href="#t-semaforo" />
        <Tarjeta titulo="Costo real (AC)" valor={centavos(resumen.ac)} nota="COP" href="#t-semaforo" />
        <Tarjeta titulo="Cronograma (SPI)" valor={indice(resumen.spi)} nota="índice del portafolio" href="#t-semaforo" />
        <Tarjeta titulo="Costo (CPI)" valor={indice(resumen.cpi)} nota="índice del portafolio" href="#t-semaforo" />
      </section>

      <div className="mb-2 mt-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <h2 id="t-semaforo" className="scroll-mt-4 font-display text-xl font-bold text-leaf-700">Semáforo de proyectos</h2>
        <form className="flex flex-wrap items-center gap-2" aria-label="Filtros">
          <FiltroCompacto etiqueta="Estado" name="estado" defaultValue={f.estado ?? ""}>
            <option value="">Vigentes</option>
            <option value="todos">Todos</option>
            {Object.entries(ETIQUETA_ESTADO).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </FiltroCompacto>
          <FiltroCompacto etiqueta="Fase" name="fase" defaultValue={f.fase ?? ""}>
            <option value="">Todas</option>
            {Object.entries(ETIQUETA_FASE).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </FiltroCompacto>
          <FiltroCompacto etiqueta="Portafolio" name="portafolio" defaultValue={f.portafolio ?? ""}>
            <option value="">Todos</option>
            {portafolios.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </FiltroCompacto>
          <FiltroCompacto etiqueta="Gerente" name="gerente" defaultValue={f.gerente ?? ""}>
            <option value="">Todos</option>
            {gerentes.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
          </FiltroCompacto>
          <button className={`${claseBoton.secundario} !h-9 !px-4`}>Filtrar</button>
          {hayFiltro && <Link href="/" className={`${claseBoton.contorno} !h-9 !px-4`}>Quitar filtros</Link>}
          {!f.estado && nCerrados > 0 && <Link href="/?estado=cerrado" className="text-sm font-medium text-leaf-600 hover:underline">Histórico ({nCerrados})</Link>}
        </form>
      </div>

      <section aria-labelledby="t-semaforo">
        {filas.length === 0 ? (
          <p className="mt-3 rounded-card bg-leaf-50 p-6 text-sm text-muted">
            {hayFiltro ? "Ningún proyecto coincide con los filtros." : esAdmin ? "Aún no hay proyectos. Crea el primero con el botón “Nuevo proyecto”." : "Todavía no tienes proyectos asignados. Pide al administrador que te agregue a uno."}
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-card border border-soil-border">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="bg-leaf-100 text-xs uppercase tracking-wider text-leaf-800">
                <tr>{["Proyecto", "Estado", "Presupuesto (BAC)", "Costo real (AC)", "Cronograma (SPI)", "Costo (CPI)", "Riesgos", "Cambios", "Avance físico", "Avance presup.", "Reportado"].map((h) => <th key={h} className="px-2.5 py-2 font-medium"><span className="inline-flex items-center gap-1">{h}{temaDe(h) && <Ayuda tema={temaDe(h)} />}</span></th>)}</tr>
              </thead>
              <tbody className="divide-y divide-soil-border">
                {filas.map((r) => {
                  const base = `/proyectos/${r.proyecto.id}`;
                  const evmHref = `${base}/evm`;
                  return (
                    <tr key={r.proyecto.id}>
                      <td className="min-w-[10rem] px-2.5 py-2">
                        <Link href={base} className="font-medium text-leaf-700 hover:underline">{r.proyecto.nombre}</Link>
                        <p className="text-xs text-muted">{r.proyecto.codigo} · {ETIQUETA_FASE[r.proyecto.fase as FaseProyecto]}{r.proyecto.estado !== "activo" ? ` · ${ETIQUETA_ESTADO[r.proyecto.estado as EstadoProyecto]}` : ""}</p>
                      </td>
                      <td className="px-2.5 py-2"><Link href={base}><Semaforo color={r.semaforo.general} /></Link></td>
                      <td className="px-2.5 py-2 tabular-nums"><Link href={evmHref} className="hover:underline">{centavos(r.medicion?.bac ?? null)}</Link></td>
                      <td className="px-2.5 py-2 tabular-nums"><Link href={evmHref} className="hover:underline">{centavos(r.medicion?.ac ?? null)}</Link></td>
                      <td className="px-2.5 py-2"><Link href={evmHref} className="hover:underline">{indice(r.evm?.spi ?? null)}</Link></td>
                      <td className="px-2.5 py-2"><Link href={evmHref} className="hover:underline">{indice(r.evm?.cpi ?? null)}</Link></td>
                      <td className="px-2.5 py-2"><Link href={`${base}/r/riesgos`} className="hover:underline">{r.riesgoMaximo ? NIVEL[r.riesgoMaximo] : "—"}</Link></td>
                      <td className="px-2.5 py-2"><Link href={`${base}/cambios`} className="hover:underline">{r.cambiosPendientes}</Link></td>
                      <td className="px-2.5 py-2"><Link href={evmHref} className="hover:underline">{porcentaje(r.evm?.avanceFisico ?? null)}</Link></td>
                      <td className="px-2.5 py-2"><Link href={evmHref} className="hover:underline">{porcentaje(r.evm?.avanceFinanciero ?? null)}</Link></td>
                      <td className="px-2.5 py-2">
                        {r.reporte ? (
                          <span className="flex flex-col gap-1">
                            <Semaforo color={r.reporte.estado_reportado} />
                            {r.semaforo.general && r.reporte.estado_reportado !== r.semaforo.general && <span className="text-xs text-danger">Difiere del calculado</span>}
                            {r.reporte.alertas && <span className="max-w-[180px] truncate text-xs text-muted" title={r.reporte.alertas}>{r.reporte.alertas}</span>}
                          </span>
                        ) : <span className="text-muted">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10" aria-labelledby="t-decision">
        <h2 id="t-decision" className="font-display text-2xl font-bold text-leaf-700">Requiere decisión</h2>
        {decisiones.length === 0 ? (
          <p className="mt-3 rounded-card bg-leaf-50 p-5 text-sm text-muted">Nada pendiente de decisión.</p>
        ) : (
          <ul className="mt-3 divide-y divide-soil-border rounded-card border border-soil-border">
            {decisiones.map((d, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <span><strong>{d.tipo}</strong> · {d.proyecto} · <span className="text-muted">{d.detalle}</span></span>
                <Link href={d.href} className="font-medium text-leaf-600 hover:underline">Ver</Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10" aria-labelledby="t-kpis">
        <h2 id="t-kpis" className="font-display text-2xl font-bold text-leaf-700">Indicadores de gestión</h2>
        <p className="mt-1 text-sm text-muted">Mensuales, de los proyectos que ves con los filtros actuales. Pasa el cursor sobre un mes para ver “n de m”.</p>
        <div className="mt-3"><TablaKpis series={kpis} /></div>
      </section>
    </>
  );
}

function FiltroCompacto({ etiqueta, children, ...resto }: { etiqueta: string; children: React.ReactNode } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="flex items-center gap-1.5 text-xs font-medium text-leaf-800">
      {etiqueta}
      <select {...resto} className="h-9 max-w-[11rem] rounded-lg border border-soil-border bg-white px-2 text-sm font-normal text-leaf-900 focus:border-leaf-500 focus:outline-none focus:ring-2 focus:ring-leaf-500/30">{children}</select>
    </label>
  );
}

function Tarjeta({ titulo, valor, nota, href }: { titulo: string; valor: string; nota?: string; href?: string }) {
  const contenido = (
    <>
      <p className="pr-5 text-[11px] font-medium uppercase leading-tight tracking-wide text-leaf-800">{titulo}</p>
      <p className="mt-0.5 font-display text-xl font-bold leading-tight text-leaf-700 [overflow-wrap:anywhere]">{valor}</p>
      {nota && <p className="text-[11px] leading-tight text-muted">{nota}</p>}
    </>
  );
  return (
    <Ayuda modo="tarjeta" tema={temaDe(titulo)} className="rounded-card bg-leaf-100">
      {href ? <Link href={href} className="block rounded-card px-3 py-2 transition hover:shadow-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-leaf-600">{contenido}</Link> : <div className="px-3 py-2">{contenido}</div>}
    </Ayuda>
  );
}

export default function PaginaInicio({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Cargando el tablero…</p>}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}
