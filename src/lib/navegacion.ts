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
export function enlacesAdministracion(rolGlobal: RolGlobal | null): NavEnlace[] {
  const out: NavEnlace[] = [];
  if (rolGlobal === "administrador") out.push({ href: "/usuarios", titulo: "Usuarios" }, { href: "/organizacion", titulo: "Organización" });
  if (rolGlobal) out.push({ href: "/parametros", titulo: "Parámetros" });
  if (rolGlobal === "administrador" || rolGlobal === "director_general") out.push({ href: "/auditoria", titulo: "Auditoría" });
  return out;
}

// Id del proyecto que se está viendo (según la dirección), o null.
export function proyectoDeRuta(ruta: string): string | null {
  const m = /^\/proyectos\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/|$)/i.exec(ruta);
  return m ? m[1] : null;
}
