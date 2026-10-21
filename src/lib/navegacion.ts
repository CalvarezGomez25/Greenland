// Datos del menú lateral: proyectos que la persona puede ver y, de cada uno, los módulos a los que puede entrar.
// Son funciones puras (sin red) para poder probarlas.
import { MODULOS } from "./modulos";
import { calcularPermisos } from "./permisos";
import type { RolGlobal, RolProyecto } from "./tipos";

export type NavModulo = { clave: string; titulo: string; href: string; area: "gestion" | "obra" | "interventoria" };
export type NavProyecto = { id: string; nombre: string; codigo: string | null; estado: string; modulos: NavModulo[] };
export type NavEnlace = { href: string; titulo: string };

export const ETIQUETA_AREA: Record<NavModulo["area"], string> = { gestion: "Gestión", obra: "Obra", interventoria: "Interventoría" };

// Orden del menú: por código del proyecto (GL-001, GL-002, … GL-010), con los números en orden natural;
// los que no tienen código van al final, ordenados por nombre.
export function ordenarPorCodigo<T extends { codigo: string | null; nombre: string }>(lista: T[]): T[] {
  const c = new Intl.Collator("es", { numeric: true, sensitivity: "base" });
  return [...lista].sort((a, b) => {
    if (a.codigo && b.codigo) return c.compare(a.codigo, b.codigo) || c.compare(a.nombre, b.nombre);
    if (a.codigo) return -1;
    if (b.codigo) return 1;
    return c.compare(a.nombre, b.nombre);
  });
}

export function armarProyectosNav(
  proyectos: { id: string; nombre: string; codigo: string | null; estado: string; usa_obra: boolean | null }[],
  roles: Map<string, RolProyecto>,
  rolGlobal: RolGlobal | null,
): NavProyecto[] {
  return ordenarPorCodigo(proyectos).map((p) => {
    const permisos = calcularPermisos(rolGlobal, roles.get(p.id) ?? null);
    const modulos = MODULOS.filter((m) => m.disponible && m.ver(permisos, p.usa_obra !== false)).map((m) => ({
      clave: m.clave, titulo: m.corto, href: `/proyectos/${p.id}/${m.ruta}`, area: m.area,
    }));
    return { id: p.id, nombre: p.nombre, codigo: p.codigo, estado: p.estado, modulos };
  });
}

// Enlaces de administración según el rol global.
// El directorio de contactos lo usan administrador, director general, analista PMO y quien sea gerente de algún proyecto.
export function puedeUsarDirectorio(rolGlobal: RolGlobal | null, roles: Iterable<RolProyecto>): boolean {
  if (rolGlobal === "administrador" || rolGlobal === "director_general" || rolGlobal === "analista_pmo") return true;
  for (const r of roles) if (r === "gerente") return true;
  return false;
}

export function enlacesAdministracion(rolGlobal: RolGlobal | null, conDirectorio = false): NavEnlace[] {
  const out: NavEnlace[] = [];
  if (rolGlobal === "administrador") out.push({ href: "/usuarios", titulo: "Usuarios" }, { href: "/organizacion", titulo: "Organización" });
  if (rolGlobal) out.push({ href: "/parametros", titulo: "Parámetros" });
  if (rolGlobal === "administrador" || rolGlobal === "director_general") out.push({ href: "/auditoria", titulo: "Auditoría" });
  if (conDirectorio) out.push({ href: "/directorio", titulo: "Directorio de contactos" });
  return out;
}

// Primera pantalla de cada persona. Quien ve todo el portafolio (rol global) entra al tablero de control; las demás
// personas (gerentes, supervisores, patrocinio, consulta e interventoría) entran a «Mi trabajo», con sus actividades
// pendientes a primera vista, y desde ahí van a sus proyectos.
export const RUTA_TABLERO_PROPIO = "/tablero"; // el tablero limitado a los proyectos de quien no ve todo el portafolio
export function rutaDeInicio(rolGlobal: RolGlobal | null): "/" | "/mi-trabajo" {
  return rolGlobal ? "/" : "/mi-trabajo";
}
// Dirección del tablero de control que le corresponde a la persona.
export function rutaDelTablero(rolGlobal: RolGlobal | null): "/" | typeof RUTA_TABLERO_PROPIO {
  return rolGlobal ? "/" : RUTA_TABLERO_PROPIO;
}

// ¿Solo es interventoría? Sin rol global y con todas sus asignaciones como interventoría. Esa persona no usa tablero de
// control (la interventoría no entra por el portafolio): su inicio es «Mi trabajo», que ya lista sus proyectos.
export function esSoloInterventoria(rolGlobal: RolGlobal | null, roles: Iterable<RolProyecto>): boolean {
  if (rolGlobal) return false;
  let hay = false;
  for (const r of roles) { if (r !== "interventoria") return false; hay = true; }
  return hay;
}

// «Mis proyectos» de «Mi trabajo»: los proyectos donde la persona está asignada. Quien no tiene rol global siempre ve la
// sección (si no tiene proyectos, se le explica); quien sí lo tiene (y ve todo el portafolio) la ve solo si además está
// asignado a algún proyecto, para no listarle todo el portafolio.
export function mostrarMisProyectos(rolGlobal: RolGlobal | null, asignaciones: number): boolean {
  return rolGlobal === null || asignaciones > 0;
}

// Id del proyecto que se está viendo (según la dirección), o null.
export function proyectoDeRuta(ruta: string): string | null {
  const m = /^\/proyectos\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/|$)/i.exec(ruta);
  return m ? m[1] : null;
}
