// Documentos: tipos, etiquetas y utilidades de nombre y tamaño.

export const TIPOS_DOCUMENTO: [string, string][] = [["plano", "Plano"], ["contrato", "Contrato"], ["acta", "Acta"], ["informe", "Informe"], ["otro", "Otro"]];
export const MAX_BYTES_DOCUMENTO = 50 * 1024 * 1024; // límite de Supabase Storage en el plan gratuito

export const etiquetaTipo = (t: string) => TIPOS_DOCUMENTO.find(([k]) => k === t)?.[1] ?? t;

// Nombre de archivo seguro para la ruta de almacenamiento (sin acentos, espacios ni símbolos raros).
export function nombreSeguro(nombre: string): string {
  const base = nombre.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-+(\.[A-Za-z0-9]+)$/, "$1").replace(/^[-.]+|-+$/g, "");
  const recortado = base.length > 120 ? `${base.slice(0, 100)}${base.slice(base.lastIndexOf(".") > 0 ? base.lastIndexOf(".") : base.length)}`.slice(0, 120) : base;
  // Nombre sin letras latinas (por ejemplo «資料.pdf»): se conserva la extensión.
  const ext = nombre.match(/\.([A-Za-z0-9]{1,8})$/)?.[1];
  if (ext && recortado === ext) return `archivo.${ext}`;
  return recortado || "archivo";
}

export function tamanoLegible(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString("es-CO", { maximumFractionDigits: 0 })} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString("es-CO", { maximumFractionDigits: 1 })} MB`;
}
