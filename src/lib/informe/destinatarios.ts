// Quién recibe qué en el informe semanal. Función pura (sin red) para poder probarla.
// - Roles globales (administrador, director, analista PMO, finanzas): todos los proyectos activos.
// - Demás personas: los proyectos donde son miembros, salvo la interventoría (su acceso es reducido y no ve costos ni riesgos).
// - Sin correo válido, o el usuario técnico de las alertas: no reciben nada.
export type PerfilEnvio = { id: string; nombre: string; correo: string | null; rol_global: string | null };
export type MiembroEnvio = { proyecto_id: string; usuario_id: string; rol: string };
export type Destinatario = { id: string; nombre: string; correo: string; proyectoIds: string[] };

const ROLES_TODOS = new Set(["administrador", "director_general", "analista_pmo", "finanzas"]);
const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

export function repartirInformes(proyectoIds: string[], perfiles: PerfilEnvio[], miembros: MiembroEnvio[], excluirCorreo?: string): Destinatario[] {
  const activos = new Set(proyectoIds);
  const excluir = (excluirCorreo ?? "").trim().toLowerCase();
  const out: Destinatario[] = [];
  for (const p of perfiles) {
    const correo = (p.correo ?? "").trim();
    if (!EMAIL.test(correo) || correo.toLowerCase() === excluir) continue;
    const propios = miembros.filter((m) => m.usuario_id === p.id && m.rol !== "interventoria" && activos.has(m.proyecto_id)).map((m) => m.proyecto_id);
    const ids = p.rol_global && ROLES_TODOS.has(p.rol_global) ? proyectoIds : [...new Set(propios)].filter((id) => activos.has(id));
    if (ids.length === 0) continue;
    // mismo orden que la lista de proyectos
    out.push({ id: p.id, nombre: p.nombre, correo, proyectoIds: proyectoIds.filter((id) => ids.includes(id)) });
  }
  return out;
}
