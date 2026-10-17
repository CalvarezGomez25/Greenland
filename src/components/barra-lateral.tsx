"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ETIQUETA_AREA, proyectoDeRuta, type NavEnlace, type NavProyecto } from "@/lib/navegacion";

type Props = {
  proyectos: NavProyecto[];
  administracion: NavEnlace[];
  puedeCrear: boolean;
  conPortafolio: boolean; // ve todo el portafolio: su tablero es el general; si no, «Mi trabajo» va primero y el tablero es solo de sus proyectos
  usuario: { nombre: string; rol: string | null };
  nombrePlataforma: string;
  salir: ReactNode; // botón «Salir» (formulario con acción del servidor)
  cambiarUsuario: ReactNode; // botón de ícono «Cambiar de usuario»
};

// Íconos de trazo simple (24 × 24) por módulo.
const ICONOS: Record<string, string> = {
  acta: "M6 3h9l4 4v14H6z M14 3v5h5 M9 13h7 M9 17h7",
  evm: "M3 3v18h18 M7 15l4-4 3 3 5-6",
  stakeholders: "M9 11a3 3 0 100-6 3 3 0 000 6z M3 20c0-3 3-5 6-5s6 2 6 5 M17 11a2.5 2.5 0 100-5 M17 15c2.5 0 4 1.5 4 4",
  wbs: "M10 3h4v4h-4z M3 17h4v4H3z M10 17h4v4h-4z M17 17h4v4h-4z M12 7v10 M5 17v-3h14v3",
  riesgos: "M12 3l10 18H2z M12 10v5 M12 18h.01",
  cambios: "M7 4l-4 4 4 4 M3 8h14 M17 20l4-4-4-4 M21 16H7",
  reportes: "M9 4h6v3H9z M7 5H5v16h14V5h-2 M9 12h6 M9 16h6",
  documentos: "M3 6h6l2 2h10v11H3z",
  cierre: "M12 21a9 9 0 100-18 9 9 0 000 18z M8 12l3 3 5-6",
  presupuesto: "M3 7h15a3 3 0 013 3v8H3z M3 7l2-3h11 M16 13h2",
  cronograma: "M4 6h16v14H4z M4 10h16 M8 3v4 M16 3v4",
  contratos: "M6 3h9l4 4v14H6z M14 3v5h5 M9 15l2 2 4-4",
  bitacora: "M4 5a2 2 0 012-2h6v18H6a2 2 0 01-2-2z M20 5a2 2 0 00-2-2h-6v18h6a2 2 0 002-2z",
  interventoria: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4",
  glosario: "M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z M4 21V5 M9 8h6 M9 12h6",
  actividades: "M4 5h4v4H4z M4 15h4v4H4z M12 7h8 M12 17h8 M5 7l1 1 2-2",
  mitrabajo: "M9 12l2 2 4-4 M12 21a9 9 0 100-18 9 9 0 000 18z",
  tablero: "M3 3h7v9H3z M14 3h7v5h-7z M14 12h7v9h-7z M3 16h7v5H3z",
  usuarios: "M9 11a3 3 0 100-6 3 3 0 000 6z M3 20c0-3 3-5 6-5s6 2 6 5",
  organizacion: "M4 21V8l8-5 8 5v13 M9 21v-6h6v6",
  parametros: "M4 6h10 M18 6h2 M4 12h4 M12 12h8 M4 18h12 M20 18h0 M16 4v4 M10 10v4 M18 16v4",
  auditoria: "M11 4a7 7 0 100 14 7 7 0 000-14z M21 21l-5-5",
};

function Icono({ clave, clase = "h-[18px] w-[18px]" }: { clave: string; clase?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={`${clase} shrink-0`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {(ICONOS[clave] ?? ICONOS.documentos).split(" M").map((d, i) => <path key={i} d={(i === 0 ? "" : "M") + d} />)}
    </svg>
  );
}

const Flecha = ({ abierta, clase = "h-4 w-4" }: { abierta: boolean; clase?: string }) => (
  <svg aria-hidden viewBox="0 0 20 20" className={`${clase} shrink-0 transition-transform ${abierta ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 4l6 6-6 6" /></svg>
);
const ChevronAbajo = ({ abierta }: { abierta: boolean }) => (
  <svg aria-hidden viewBox="0 0 20 20" className={`h-4 w-4 shrink-0 transition-transform ${abierta ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 8l5 5 5-5" /></svg>
);

const claseEnlace = (activo: boolean) =>
  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${activo ? "bg-leaf-100 font-semibold text-leaf-900" : "text-leaf-800 hover:bg-leaf-50"}`;
const etiquetaSeccion = "px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted";

export function BarraLateral({ proyectos, administracion, puedeCrear, conPortafolio, usuario, nombrePlataforma, salir, cambiarUsuario }: Props) {
  const ruta = usePathname();
  const actualId = proyectoDeRuta(ruta);
  const actual = proyectos.find((p) => p.id === actualId) ?? null;
  const [movil, setMovil] = useState(false);
  const [selector, setSelector] = useState(false);
  const [rutaVista, setRutaVista] = useState(ruta);
  const [cerradas, setCerradas] = useState<string[]>([]); // grupos de módulos contraídos
  const [busqueda, setBusqueda] = useState("");

  // Al cambiar de pantalla se cierran el menú del celular y la lista de proyectos.
  if (ruta !== rutaVista) {
    setRutaVista(ruta);
    setMovil(false);
    setSelector(false);
    setBusqueda("");
  }

  useEffect(() => {
    if (!movil && !selector) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") { setMovil(false); setSelector(false); } };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [movil, selector]);

  // La opción activa siempre queda a la vista dentro del menú.
  useEffect(() => {
    document.querySelector('#menu-lateral [aria-current="page"]')?.scrollIntoView({ block: "nearest" });
  }, [ruta]);

  const alternar = (g: string) => setCerradas((l) => (l.includes(g) ? l.filter((x) => x !== g) : [...l, g]));
  const filtro = busqueda.trim().toLowerCase();
  const coincide = (p: NavProyecto) => !filtro || `${p.nombre} ${p.codigo ?? ""}`.toLowerCase().includes(filtro);
  const vigentes = proyectos.filter((p) => p.estado !== "cerrado" && p.estado !== "cancelado" && coincide(p));
  const cerrados = proyectos.filter((p) => (p.estado === "cerrado" || p.estado === "cancelado") && coincide(p));
  const filaProyecto = (p: NavProyecto) => (
    <li key={p.id}>
      <Link href={`/proyectos/${p.id}`} aria-current={p.id === actualId ? "page" : undefined} className={`${claseEnlace(p.id === actualId)} !py-2`}>
        <span className="min-w-0 flex-1"><span className="block truncate">{p.nombre}</span>{p.codigo && <span className="block text-xs font-normal text-muted">{p.codigo}</span>}</span>
      </Link>
    </li>
  );

  const areas = actual ? (["gestion", "obra", "interventoria"] as const).map((a) => [a, actual.modulos.filter((m) => m.area === a)] as const).filter(([, l]) => l.length > 0) : [];

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-soil-border bg-white px-4 py-2.5 lg:hidden">
        <button type="button" onClick={() => setMovil(true)} aria-label="Abrir el menú" aria-expanded={movil} aria-controls="menu-lateral" className="rounded-lg p-2 text-leaf-800 hover:bg-leaf-100">
          <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <Link href="/" className="font-display text-xl font-bold text-leaf-600">{nombrePlataforma}</Link>
        <span className="min-w-0 max-w-[40%] truncate text-xs text-muted">{actual?.nombre ?? ""}</span>
      </div>

      {movil && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setMovil(false)} aria-hidden />}

      <aside id="menu-lateral" aria-label="Menú de navegación" className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-soil-border bg-white transition-transform lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-64 lg:max-w-none lg:shrink-0 lg:translate-x-0 xl:w-72 ${movil ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-start justify-between px-5 pb-1 pt-5">
          <div>
            <Link href="/" aria-label="Ir a la pantalla de inicio" className="block"><Image src="/logo-greenland.png" alt="GreenLand" width={1737} height={528} className="h-auto w-32" priority /></Link>
            <p className="mt-1 font-display text-xl font-bold leading-none text-leaf-600">{nombrePlataforma}</p>
          </div>
          <button type="button" onClick={() => setMovil(false)} aria-label="Cerrar el menú" className="rounded-lg p-2 text-leaf-800 hover:bg-leaf-100 lg:hidden">
            <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <nav aria-label="Principal" className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          <p className={etiquetaSeccion}>Espacio de trabajo</p>
          {conPortafolio ? (
            <>
              <Link href="/" aria-current={ruta === "/" ? "page" : undefined} className={claseEnlace(ruta === "/")}><Icono clave="tablero" /> Tablero de control</Link>
              <Link href="/mi-trabajo" aria-current={ruta === "/mi-trabajo" ? "page" : undefined} className={claseEnlace(ruta === "/mi-trabajo")}><Icono clave="mitrabajo" /> Mi trabajo</Link>
            </>
          ) : (
            <>
              <Link href="/mi-trabajo" aria-current={ruta === "/mi-trabajo" ? "page" : undefined} className={claseEnlace(ruta === "/mi-trabajo")}><Icono clave="mitrabajo" /> Mi trabajo</Link>
              <Link href="/tablero" aria-current={ruta === "/tablero" ? "page" : undefined} className={claseEnlace(ruta === "/tablero")}><Icono clave="tablero" /> Tablero de mis proyectos</Link>
            </>
          )}
          <Link href="/glosario" aria-current={ruta === "/glosario" ? "page" : undefined} className={claseEnlace(ruta === "/glosario")}><Icono clave="glosario" /> Ayuda</Link>

          <div className="relative mt-2">
            <button type="button" onClick={() => setSelector((v) => !v)} aria-expanded={selector} aria-haspopup="listbox" className="flex w-full items-center gap-3 rounded-xl border border-soil-border bg-leaf-50/60 px-3 py-2.5 text-left hover:bg-leaf-50">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-leaf-900">{actual ? actual.nombre : "Proyectos"}</span>
                <span className="block truncate text-xs text-muted">{actual ? (actual.codigo ?? "Proyecto actual") : `${proyectos.length} ${proyectos.length === 1 ? "proyecto" : "proyectos"} · elige uno`}</span>
              </span>
              <ChevronAbajo abierta={selector} />
            </button>
            {selector && (
              <div className="absolute inset-x-0 top-full z-10 mt-1 max-h-[60vh] overflow-y-auto rounded-xl border border-soil-border bg-white p-2 shadow-card">
                {proyectos.length > 5 && (
                  <input type="search" autoFocus value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar proyecto…" aria-label="Buscar proyecto" className="mb-2 h-9 w-full rounded-lg border border-soil-border px-3 text-sm focus:border-leaf-500 focus:outline-none focus:ring-2 focus:ring-leaf-500/30" />
                )}
                {proyectos.length === 0 && <p className="px-3 py-2 text-sm text-muted">Aún no tienes proyectos.</p>}
                {proyectos.length > 0 && vigentes.length === 0 && cerrados.length === 0 && <p className="px-3 py-2 text-sm text-muted">Sin coincidencias.</p>}
                <ul>{vigentes.map(filaProyecto)}</ul>
                {cerrados.length > 0 && (<><p className={etiquetaSeccion}>Cerrados</p><ul>{cerrados.map(filaProyecto)}</ul></>)}
                {puedeCrear && <Link href="/proyectos/nuevo" className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-leaf-600 hover:bg-leaf-50">+ Nuevo proyecto</Link>}
              </div>
            )}
          </div>

          <p className={etiquetaSeccion}>Gestión del proyecto</p>
          {!actual && <p className="px-3 py-2 text-sm text-muted">Elige un proyecto en la lista de arriba para ver sus módulos.</p>}
          {actual && areas.map(([area, lista]) => {
            const grupo = `${actual.id}:${area}`;
            const abierto = !cerradas.includes(grupo);
            return (
              <div key={area} className="mb-1">
                {areas.length > 1 && (
                  <button type="button" onClick={() => alternar(grupo)} aria-expanded={abierto} className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-xs font-semibold text-leaf-700 hover:bg-leaf-50">
                    {ETIQUETA_AREA[area]} <Flecha abierta={abierto} clase="h-3.5 w-3.5" />
                  </button>
                )}
                {(abierto || areas.length === 1) && (
                  <ul>
                    {lista.map((m) => {
                      const activo = ruta === m.href || ruta.startsWith(`${m.href}/`);
                      return <li key={m.clave}><Link href={m.href} aria-current={activo ? "page" : undefined} className={claseEnlace(activo)}><Icono clave={m.clave} />{m.titulo}</Link></li>;
                    })}
                  </ul>
                )}
              </div>
            );
          })}

          {administracion.length > 0 && (
            <div className="mt-2">
              <button type="button" onClick={() => alternar("administracion")} aria-expanded={!cerradas.includes("administracion")} className={`${etiquetaSeccion} flex w-full items-center justify-between`}>
                Administración <Flecha abierta={!cerradas.includes("administracion")} clase="h-3.5 w-3.5" />
              </button>
              {!cerradas.includes("administracion") && administracion.map((e) => {
                const activo = ruta === e.href || ruta.startsWith(`${e.href}/`);
                const clave = e.href.slice(1);
                return <Link key={e.href} href={e.href} aria-current={activo ? "page" : undefined} className={claseEnlace(activo)}><Icono clave={clave} />{e.titulo}</Link>;
              })}
            </div>
          )}
        </nav>

        <div className="border-t border-soil-border p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-leaf-900" title={usuario.nombre}>{usuario.nombre}</p>
              {usuario.rol && <p className="truncate text-xs text-muted" title={usuario.rol}>{usuario.rol}</p>}
            </div>
            {cambiarUsuario}
          </div>
          <div className="mt-2">{salir}</div>
        </div>
      </aside>
    </>
  );
}
