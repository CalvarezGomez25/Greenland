// Qué guía del glosario corresponde a la pantalla que se está viendo (según la dirección).
// Devuelve la clave de la guía (ver src/lib/guias.ts) o null si la pantalla no tiene guía propia.
const POR_SEGMENTO: Record<string, string> = {
  acta: "acta", evm: "evm", cambios: "cambios", reportes: "reportes", cronograma: "cronograma", contratos: "contratos",
  bitacora: "bitacora", actividades: "actividades", documentos: "documentos", cierre: "cierre", presupuesto: "presupuesto", interventoria: "interventoria",
  "importar-riesgos": "riesgos",
};
const POR_REGISTRO: Record<string, string> = {
  stakeholders: "interesados", wbs: "edt", riesgos: "riesgos", hitos: "reportes", reuniones: "reportes", lecciones: "cierre", tareas: "cronograma", actividades: "actividades",
};

export function guiaDeRuta(ruta: string): string | null {
  const m = /^\/proyectos\/[0-9a-f-]{36}\/([^/?#]+)(?:\/([^/?#]+))?/i.exec(ruta);
  if (!m) return null;
  if (m[1] === "r") return (m[2] && POR_REGISTRO[m[2]]) || null;
  return POR_SEGMENTO[m[1]] ?? null;
}
