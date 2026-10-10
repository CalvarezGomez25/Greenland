// Resolución de parámetros en el servidor de la aplicación: proyecto > portafolio > global.

export type FilaParametro = { ambito: string; ambito_id: string | null; clave: string; valor: string };

export function valorParametro(
  filas: FilaParametro[],
  clave: string,
  ctx: { proyectoId?: string | null; portafolioId?: string | null } = {},
): string | null {
  const de = (ambito: string, id: string | null) =>
    filas.find((f) => f.clave === clave && f.ambito === ambito && f.ambito_id === id)?.valor;
  return (
    (ctx.proyectoId ? de("proyecto", ctx.proyectoId) : undefined) ??
    (ctx.portafolioId ? de("portafolio", ctx.portafolioId) : undefined) ??
    de("global", null) ??
    null
  );
}

export function numeroParametro(
  filas: FilaParametro[],
  clave: string,
  ctx: { proyectoId?: string | null; portafolioId?: string | null },
  respaldo: number,
): number {
  const v = valorParametro(filas, clave, ctx);
  const n = v === null ? NaN : Number(v);
  return Number.isFinite(n) ? n : respaldo;
}

export function listaParametro(filas: FilaParametro[], clave: string, ctx: { proyectoId?: string | null; portafolioId?: string | null } = {}): string[] {
  return (valorParametro(filas, clave, ctx) ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}
