// Validación común de los datos de un proyecto (crear y editar).

export type DatosProyecto = {
  nombre: string;
  cliente: string | null;
  ubicacion: string | null;
  fecha_inicio: string;
  duracion_meses: number;
};

function textoOpcional(valor: FormDataEntryValue | null, maximo: number) {
  const t = String(valor ?? "").trim();
  return t.length > 0 && t.length <= maximo ? t : t.length === 0 ? null : undefined;
}

export function validarProyecto(datos: FormData): { error: string } | { datos: DatosProyecto } {
  const nombre = String(datos.get("nombre") ?? "").trim();
  const cliente = textoOpcional(datos.get("cliente"), 120);
  const ubicacion = textoOpcional(datos.get("ubicacion"), 160);
  const fecha = String(datos.get("fecha_inicio") ?? "");
  const duracion = Number(datos.get("duracion_meses"));

  if (nombre.length === 0 || nombre.length > 120) {
    return { error: "El nombre es obligatorio (máximo 120 caracteres)." };
  }
  if (cliente === undefined) return { error: "El cliente no puede superar 120 caracteres." };
  if (ubicacion === undefined) return { error: "La ubicación no puede superar 160 caracteres." };

  const fechaValida =
    /^\d{4}-\d{2}-\d{2}$/.test(fecha) && !Number.isNaN(new Date(`${fecha}T00:00:00`).getTime());
  if (!fechaValida) return { error: "Indica una fecha de inicio válida." };

  if (!Number.isInteger(duracion) || duracion < 1 || duracion > 120) {
    return { error: "La duración debe ser un número entero de meses entre 1 y 120." };
  }
  return { datos: { nombre, cliente, ubicacion, fecha_inicio: fecha, duracion_meses: duracion } };
}
