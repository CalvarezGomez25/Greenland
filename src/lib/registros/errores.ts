// Traduce errores de la base de datos a mensajes para la persona usuaria.
export function mensajeDeBase(error: { code?: string; message: string }): string {
  if (error.code === "42501") return "No tienes permiso para hacer esto.";
  if (error.code === "22023") return error.message;
  if (error.code === "23514") return "Algún valor no es válido. Revisa los datos.";
  if (error.code === "23505") return "Ya existe un registro con ese código o nombre.";
  if (error.code === "23503") return "Hay un dato relacionado que no existe o que impide la operación.";
  if (error.code === "PGRST205" || error.code === "42P01") return "Falta instalar la base de datos de este módulo. Avisa al administrador.";
  console.error("Fallo en un registro:", { codigo: error.code, mensaje: error.message });
  return `No se pudo guardar${error.code ? ` (código ${error.code})` : ""}. Intenta de nuevo.`;
}
