// Supabase entrega como máximo 1.000 filas por consulta. Un presupuesto puede tener hasta
// 5.000 partidas, así que se lee por páginas hasta que una venga incompleta.

export const TAMANO_PAGINA = 1000;

type Pagina<T> = { data: T[] | null; error: { message: string; code?: string } | null };

// Error de la base de datos con su código (por ejemplo "42501" = sin permiso, "PGRST205" = tabla no encontrada).
export class ErrorDeBase extends Error {
  constructor(
    message: string,
    readonly codigo?: string,
  ) {
    super(message);
    this.name = "ErrorDeBase";
  }
}

export async function leerTodo<T>(
  pedir: (desde: number, hasta: number) => PromiseLike<Pagina<T>>,
  maximo = 20_000,
): Promise<T[]> {
  const todas: T[] = [];
  for (let desde = 0; desde < maximo; desde += TAMANO_PAGINA) {
    const { data, error } = await pedir(desde, desde + TAMANO_PAGINA - 1);
    if (error) throw new ErrorDeBase(error.message, error.code);
    const filas = data ?? [];
    todas.push(...filas);
    if (filas.length < TAMANO_PAGINA) return todas;
  }
  throw new Error(`Se superó el máximo de ${maximo} filas.`);
}
