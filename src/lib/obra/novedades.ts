// Novedades de campo de un contrato: tipos y límites (compartidos por la pantalla y las acciones).
export const MAX_FOTOS_NOVEDAD = 3;
export const TIPOS_NOVEDAD: [string, string][] = [
  ["acta_inicio", "Se firmó el acta de inicio"], ["poliza", "Se expidió o renovó una póliza"], ["modificacion", "Se firmó una modificación (otrosí, adición, prórroga)"],
  ["suspension", "Se suspendió el contrato"], ["reinicio", "Se reinició el contrato"], ["comunicacion", "Una comunicación o compromiso"], ["otro", "Otra novedad"],
];
export const TIPOS_QUE_SE_APLICAN_SOLOS = new Set(["acta_inicio", "suspension", "reinicio"]);
