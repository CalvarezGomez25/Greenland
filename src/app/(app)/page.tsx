import { Suspense } from "react";
import Link from "next/link";
import { obtenerSesion } from "@/lib/sesion";
import { cargarDashboard } from "@/lib/pmo/dashboard";
import { TablaKpis } from "@/components/kpis";
import { centavos, indice, porcentaje } from "@/lib/pmo/formato";
import { ETIQUETA_ESTADO, ETIQUETA_FASE, type EstadoProyecto, type FaseProyecto } from "@/lib/tipos";
import { Semaforo } from "@/components/semaforo";
import { BotonesExportar } from "@/components/botones-exportar";
import { Aviso, Selector, Titulo, claseBoton } from "@/components/ui";

type Filtros = { estado?: string; fase?: string; portafolio?: string; gerente?: string };
const NIVEL: Record<string, string> = { critico: "Crítico", alto: "Alto", medio: "Medio", bajo: "Bajo" };

async function Dashboard({ searchParams }: { searchParams: Promise<Filtros> }) {
  const f = await searchParams;
  const { supabase, perfil } = await obtenerSesion();
  if (!perfil) return <Aviso>Tu cuenta aún no tiene perfil en la plataforma. Avisa al administrador.</Aviso>;

  const d = await cargarDashboard(supabase, f);
  if (!d) return <Aviso>No se pudieron cargar los proyectos. Intenta de nuevo.</Aviso>;
  const { filas, resumen, decisiones, kpis, portafolios, gerentes, nCerrados } = d;
  const esAdmin = perfil.rol_global === "administrador";
  const hayFiltro = Boolean(f.estado || f.fase || f.portafolio || f.gerente);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Titulo>Dashboard del portafolio</Titulo>
          <p className="mt-3 text-sm text-muted">
            {perfil.rol_global ? "Todos los proyectos de la plataforma." : "Los proyectos en los que estás asignado."}
            {resumen.semana && ` Corte: semana ${resumen.semana.semana} de ${resumen.semana.anio} (${resumen.corte}).`}
          </p>
        </div>
        {esAdmin && <Link href="/proyectos/nuevo" className={claseBoton.primario}>Nuevo proyecto</Link>}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3"><span className="text-sm text-muted">Exportar lo que ves:</span><BotonesExportar base={`/exportar/dashboard?${new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString()}`} /></div>

      <section aria-label="Resumen del portafolio" className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <Tarjeta titulo="Proyectos activos" valor={String(resumen.activos)} />
        <Tarjeta titulo="Verde / Amarillo / Rojo" valor={`${resumen.verdes} / ${resumen.amarillos} / ${resumen.rojos}`} nota={resumen.sinDatos ? `${resumen.sinDatos} sin datos` : undefined} />
        <Tarjeta titulo="BAC total (COP)" valor={centavos(resumen.bac)} />
        <Tarjeta titulo="AC total (COP)" valor={centavos(resumen.ac)} />
        <Tarjeta titulo="SPI del portafolio" valor={indice(resumen.spi)} nota="Suma de EV / suma de PV" />
        <Tarjeta titulo="CPI del portafolio" valor={indice(resumen.cpi)} nota="Suma de EV / suma de AC" />
      </section>

      <form className="mt-8 flex flex-wrap items-end gap-3" aria-label="Filtros">
        <Selector etiqueta="Estado" name="estado" defaultValue={f.estado ?? ""}>
          <option value="">Vigentes (activos y en pausa)</option>
          <option value="todos">Todos, con el histórico</option>
          {Object.entries(ETIQUETA_ESTADO).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </Selector>
        <Selector etiqueta="Fase" name="fase" defaultValue={f.fase ?? ""}>
          <option value="">Todas</option>
          {Object.entries(ETIQUETA_FASE).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </Selector>
        <Selector etiqueta="Portafolio" name="portafolio" defaultValue={f.portafolio ?? ""}>
          <option value="">Todos</option>
          {portafolios.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </Selector>
        <Selector etiqueta="Gerente" name="gerente" defaultValue={f.gerente ?? ""}>
          <option value="">Todos</option>
          {gerentes.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
        </Selector>
        <button className={claseBoton.secundario}>Filtrar</button>
        {hayFiltro && <Link href="/" className={claseBoton.contorno}>Quitar filtros</Link>}
        {!f.estado && nCerrados > 0 && <Link href="/?estado=cerrado" className="self-center text-sm font-medium text-leaf-600 hover:underline">Ver histórico ({nCerrados} cerrado{nCerrados === 1 ? "" : "s"})</Link>}
      </form>

      <section className="mt-6" aria-labelledby="t-semaforo">
        <h2 id="t-semaforo" className="font-display text-2xl font-bold text-leaf-700">Semáforo de proyectos</h2>
        {filas.length === 0 ? (
          <p className="mt-3 rounded-card bg-leaf-50 p-6 text-sm text-muted">
            {hayFiltro ? "Ningún proyecto coincide con los filtros." : esAdmin ? "Aún no hay proyectos. Crea el primero con el botón “Nuevo proyecto”." : "Todavía no tienes proyectos asignados. Pide al administrador que te agregue a uno."}
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-card border border-soil-border">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-leaf-100 text-xs uppercase tracking-wider text-leaf-800">
                <tr>{["Proyecto", "Estado", "SPI", "CPI", "Riesgos", "Cambios", "Avance físico", "Avance presupuestal", "Reportado"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-soil-border">
                {filas.map((r) => {
                  const base = `/proyectos/${r.proyecto.id}`;
                  const evmHref = `${base}/evm`;
                  return (
                    <tr key={r.proyecto.id}>
                      <td className="px-3 py-2">
                        <Link href={base} className="font-medium text-leaf-700 hover:underline">{r.proyecto.nombre}</Link>
                        <p className="text-xs text-muted">{r.proyecto.codigo} · {ETIQUETA_FASE[r.proyecto.fase as FaseProyecto]}{r.proyecto.estado !== "activo" ? ` · ${ETIQUETA_ESTADO[r.proyecto.estado as EstadoProyecto]}` : ""}</p>
                      </td>
                      <td className="px-3 py-2"><Link href={base}><Semaforo color={r.semaforo.general} /></Link></td>
                      <td className="px-3 py-2"><Link href={evmHref} className="hover:underline">{indice(r.evm?.spi ?? null)}</Link></td>
                      <td className="px-3 py-2"><Link href={evmHref} className="hover:underline">{indice(r.evm?.cpi ?? null)}</Link></td>
                      <td className="px-3 py-2"><Link href={`${base}/r/riesgos`} className="hover:underline">{r.riesgoMaximo ? NIVEL[r.riesgoMaximo] : "—"}</Link></td>
                      <td className="px-3 py-2"><Link href={`${base}/cambios`} className="hover:underline">{r.cambiosPendientes}</Link></td>
                      <td className="px-3 py-2"><Link href={evmHref} className="hover:underline">{porcentaje(r.evm?.avanceFisico ?? null)}</Link></td>
                      <td className="px-3 py-2"><Link href={evmHref} className="hover:underline">{porcentaje(r.evm?.avanceFinanciero ?? null)}</Link></td>
                      <td className="px-3 py-2">
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
        <h2 id="t-kpis" className="font-display text-2xl font-bold text-leaf-700">KPIs de gestión</h2>
        <p className="mt-1 text-sm text-muted">Mensuales, de los proyectos que ves con los filtros actuales. Pasa el cursor sobre un mes para ver “n de m”.</p>
        <div className="mt-3"><TablaKpis series={kpis} /></div>
      </section>
    </>
  );
}

function Tarjeta({ titulo, valor, nota }: { titulo: string; valor: string; nota?: string }) {
  return (
    <div className="rounded-card bg-leaf-100 p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-leaf-800">{titulo}</p>
      <p className="mt-1 font-display text-2xl font-bold text-leaf-700">{valor}</p>
      {nota && <p className="text-xs text-muted">{nota}</p>}
    </div>
  );
}

export default function PaginaInicio({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Cargando dashboard…</p>}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}
