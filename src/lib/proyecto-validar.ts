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

export type FichaProyecto = {
  tipo: string;
  fase: string;
  estado: string;
  usa_obra: boolean;
  codigo: string | null;
  organizacion_id: string | null;
  portafolio_id: string | null;
};

const TIPOS = ["obra_civil", "industrial", "logistico", "agroindustrial", "otro"];
const FASES = ["inicio", "planificacion", "ejecucion", "cierre"];
const ESTADOS = ["activo", "en_pausa", "cerrado", "cancelado"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validarFicha(datos: FormData): { error: string } | { ficha: FichaProyecto } {
  const tipo = String(datos.get("tipo") ?? "obra_civil");
  const fase = String(datos.get("fase") ?? "inicio");
  const estado = String(datos.get("estado") ?? "activo");
  if (!TIPOS.includes(tipo)) return { error: "Tipo de proyecto no válido." };
  if (!FASES.includes(fase)) return { error: "Fase no válida." };
  if (!ESTADOS.includes(estado)) return { error: "Estado no válido." };
  const codigo = String(datos.get("codigo") ?? "").trim();
  if (codigo.length > 30) return { error: "El código no puede superar 30 caracteres." };
  const org = String(datos.get("organizacion_id") ?? "");
  const por = String(datos.get("portafolio_id") ?? "");
  if (org && !UUID.test(org)) return { error: "Organización no válida." };
  if (por && !UUID.test(por)) return { error: "Portafolio no válido." };
  return {
    ficha: {
      tipo, fase, estado,
      usa_obra: datos.get("usa_obra") === "on",
      codigo: codigo || null,
      organizacion_id: org || null,
      portafolio_id: por || null,
    },
  };
}
