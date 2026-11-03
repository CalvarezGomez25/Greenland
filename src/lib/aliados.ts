// Aliados y proveedores (terceros) y contratantes: etiquetas y formato. Las reglas de validación del NIT están en la
// base de datos (migración 0026); aquí solo se muestra.

export const TIPOS_TERCERO = ["contratista", "proveedor", "consultor", "interventor", "otro"] as const;
export const ETIQUETA_TIPO_TERCERO: Record<string, string> = {
  contratista: "Contratista", proveedor: "Proveedor", consultor: "Consultor", interventor: "Interventor", otro: "Otro",
};
export const ETIQUETA_TIPO_PERSONA: Record<string, string> = { juridica: "Persona jurídica", natural: "Persona natural" };

// Un identificador «PEND-…» es temporal: el tercero aún no entrega el RUT.
export const esNitTemporal = (nit: string) => nit.startsWith("PEND-");

// 901519601-4 → 901.519.601-4 ; 71935351 → 71.935.351 ; PEND-X se deja igual.
export function formatearNit(nit: string): string {
  if (esNitTemporal(nit)) return nit;
  const [num, dv] = nit.split("-");
  const con = num.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return dv ? `${con}-${dv}` : con;
}

export type Tercero = {
  id: string; nit: string; tipo_persona: string; razon_social: string; tipo_tercero: string; especialidad: string | null;
  municipio: string | null; direccion: string | null; correo_notificacion: string | null; telefono: string | null;
  representante_legal: string | null; estado: string; fuente: string | null; observaciones: string | null;
};
export type Contratante = {
  id: string; codigo: string; razon_social: string; nit: string | null; representante_legal: string | null; municipio: string | null;
  correo_notificacion: string | null; correo_facturacion: string | null; tope_smmlv: number | null; estado: string; observaciones: string | null;
};
