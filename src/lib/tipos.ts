export type RolGlobal = "administrador" | "director_general" | "analista_pmo" | "finanzas";
export type RolProyecto = "gerente" | "patrocinador" | "supervisor" | "interventoria" | "consulta";

export const ROLES_GLOBALES: RolGlobal[] = ["administrador", "director_general", "analista_pmo", "finanzas"];
export const ROLES_PROYECTO: RolProyecto[] = ["gerente", "patrocinador", "supervisor", "interventoria", "consulta"];

export const ETIQUETA_ROL_GLOBAL: Record<RolGlobal, string> = {
  administrador: "Administrador",
  director_general: "Director general de planificación y proyectos",
  analista_pmo: "Analista PMO",
  finanzas: "Finanzas",
};

export const ETIQUETA_ROL_PROYECTO: Record<RolProyecto, string> = {
  gerente: "Gerente de proyecto",
  patrocinador: "Patrocinador",
  supervisor: "Supervisor de obra",
  interventoria: "Interventoría",
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
  codigo: string | null;
  organizacion_id: string | null;
  portafolio_id: string | null;
  tipo: TipoProyecto;
  fase: FaseProyecto;
  estado: EstadoProyecto;
  usa_obra: boolean;
};

export type TipoProyecto = "obra_civil" | "industrial" | "logistico" | "agroindustrial" | "otro";
export type FaseProyecto = "inicio" | "planificacion" | "ejecucion" | "cierre";
export type EstadoProyecto = "activo" | "en_pausa" | "cerrado" | "cancelado";

export const ETIQUETA_TIPO: Record<TipoProyecto, string> = {
  obra_civil: "Obra civil", industrial: "Industrial", logistico: "Logístico", agroindustrial: "Agroindustrial", otro: "Otro",
};
export const ETIQUETA_FASE: Record<FaseProyecto, string> = {
  inicio: "Inicio", planificacion: "Planificación", ejecucion: "Ejecución", cierre: "Cierre",
};
export const ETIQUETA_ESTADO: Record<EstadoProyecto, string> = {
  activo: "Activo", en_pausa: "En pausa", cerrado: "Cerrado", cancelado: "Cancelado",
};

export const COLUMNAS_PROYECTO =
  "id, nombre, cliente, ubicacion, fecha_inicio, duracion_meses, moneda, codigo, organizacion_id, portafolio_id, tipo, fase, estado, usa_obra";

export type Miembro = {
  proyecto_id: string;
  usuario_id: string;
  rol: RolProyecto;
  perfiles: { nombre: string; correo: string | null } | null;
};
