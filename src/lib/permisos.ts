// Qué puede hacer cada persona en un proyecto. Esto solo decide qué se MUESTRA en pantalla;
// la seguridad real la imponen las reglas y funciones de la base de datos.

import type { RolGlobal, RolProyecto } from "./tipos";

export type Permisos = {
  admin: boolean;
  director: boolean; // Director general de planificación y proyectos
  analista: boolean;
  finanzas: boolean;
  verTodo: boolean; // ve todo el portafolio
  gerente: boolean; // gerente de ESTE proyecto
  patrocinador: boolean;
  supervisor: boolean;
  interventor: boolean; // solo interventoría (acceso reducido)
  gestionar: boolean; // administrador o gerente del proyecto
  reportar: boolean; // gestionar o analista PMO
  verAuditoria: boolean;
  rolProyecto: RolProyecto | null;
  rolGlobal: RolGlobal | null;
};

export function calcularPermisos(rolGlobal: RolGlobal | null, rolProyecto: RolProyecto | null): Permisos {
  const admin = rolGlobal === "administrador";
  const director = rolGlobal === "director_general";
  const analista = rolGlobal === "analista_pmo";
  const finanzas = rolGlobal === "finanzas";
  const verTodo = admin || director || analista || finanzas;
  const gerente = rolProyecto === "gerente";
  const gestionar = admin || gerente;
  return {
    admin,
    director,
    analista,
    finanzas,
    verTodo,
    gerente,
    patrocinador: rolProyecto === "patrocinador",
    supervisor: rolProyecto === "supervisor",
    interventor: rolProyecto === "interventoria" && !verTodo,
    gestionar,
    reportar: gestionar || analista,
    verAuditoria: admin || director || gerente,
    rolProyecto,
    rolGlobal,
  };
}
