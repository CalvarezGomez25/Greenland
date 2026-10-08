export type RolGlobal = "administrador" | "director_general";
export type RolProyecto = "gerente" | "supervisor" | "consulta";

export const ROLES_PROYECTO: RolProyecto[] = ["gerente", "supervisor", "consulta"];

export const ETIQUETA_ROL_GLOBAL: Record<RolGlobal, string> = {
  administrador: "Administrador",
  director_general: "Director general de planificación y proyectos",
};

export const ETIQUETA_ROL_PROYECTO: Record<RolProyecto, string> = {
  gerente: "Gerente de proyecto",
  supervisor: "Supervisor de obra",
  consulta: "Consulta",
};

export type Perfil = {
  id: string;
  nombre: string;
  correo: string | null;
  rol_global: RolGlobal | null;
};

export type Proyecto = {
  id: string;
  nombre: string;
  cliente: string | null;
  ubicacion: string | null;
  fecha_inicio: string; // AAAA-MM-DD
  duracion_meses: number;
  moneda: string;
};

export type Miembro = {
  proyecto_id: string;
  usuario_id: string;
  rol: RolProyecto;
  perfiles: { nombre: string; correo: string | null } | null;
};
