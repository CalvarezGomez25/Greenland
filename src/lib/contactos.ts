// Datos de contacto de los interesados y del directorio de contactos: validación y armado de sugerencias.
// Las mismas reglas están en la base de datos (migración 0023); aquí se validan antes para dar un mensaje claro.

export const CORREO = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
export const TELEFONO = /^[0-9+() .-]{6,40}$/;

export type Contacto = { id: string; nombre: string; rol: string | null; correo: string | null; telefono: string | null };

export function validarCorreo(t: string | null | undefined): string | null {
  const v = (t ?? "").trim();
  if (v === "") return null;
  if (v.length > 200) return "El correo no puede superar 200 caracteres.";
  return CORREO.test(v) ? null : "El correo no es válido. Ejemplo: nombre@empresa.co";
}

export function validarTelefono(t: string | null | undefined): string | null {
  const v = (t ?? "").trim();
  if (v === "") return null;
  return TELEFONO.test(v) ? null : "El teléfono solo puede tener números, espacios y los signos + ( ) - . (de 6 a 40 caracteres).";
}

// Enlace para llamar: deja solo números y el + inicial.
export function enlaceTelefono(t: string): string {
  const v = t.trim();
  return `tel:${v.startsWith("+") ? "+" : ""}${v.replace(/\D/g, "")}`;
}

// Opción del selector «Reutilizar un contacto del directorio» y los valores que rellena en el formulario.
export function sugerenciaDeContacto(c: Contacto): { valor: string; etiqueta: string; valores: Record<string, string> } {
  const detalle = [c.rol, c.correo].filter(Boolean).join(" · ");
  return {
    valor: c.id,
    etiqueta: detalle ? `${c.nombre} (${detalle})` : c.nombre,
    valores: { nombre: c.nombre, rol: c.rol ?? "", correo: c.correo ?? "", telefono: c.telefono ?? "" },
  };
}
