// Presupuesto sobre la EDT: niveles de la estructura y costo por elemento. Funciones puras (sin base de datos).

export type ElementoEdt = { id: string; padre_id: string | null; codigo: string; nombre: string };

// Nivel de cada elemento: 0 = raíz (sin padre), 1 = hijos de la raíz, 2 = nietos…
export function nivelesDeEdt(elementos: ElementoEdt[]): Map<string, number> {
  const porId = new Map(elementos.map((e) => [e.id, e]));
  const niveles = new Map<string, number>();
  for (const e of elementos) {
    let n = 0, actual: ElementoEdt | undefined = e;
    while (actual?.padre_id && n < 60) { actual = porId.get(actual.padre_id); n++; }
    niveles.set(e.id, n);
  }
  return niveles;
}

export type OpcionNivel = { nivel: number; cantidad: number; etiqueta: string };

// Niveles de la EDT que tienen elementos, con un texto para elegirlos (hasta el nivel 3).
export function opcionesDeNivel(elementos: ElementoEdt[]): OpcionNivel[] {
  const niveles = nivelesDeEdt(elementos);
  const cuenta = new Map<number, number>();
  for (const n of niveles.values()) cuenta.set(n, (cuenta.get(n) ?? 0) + 1);
  const nombre = (n: number) => (n === 0 ? "Raíz de la EDT" : n === 1 ? "Primer nivel (hijos de la raíz)" : n === 2 ? "Segundo nivel" : "Tercer nivel");
  return [...cuenta.entries()].filter(([n]) => n <= 3).sort((a, b) => a[0] - b[0])
    .map(([nivel, cantidad]) => ({ nivel, cantidad, etiqueta: `${nombre(nivel)} · ${cantidad} elemento${cantidad === 1 ? "" : "s"}` }));
}

// Nivel que se propone por defecto: el primero (hijos de la raíz); si no existe, la raíz.
export function nivelPorDefecto(opciones: OpcionNivel[]): number {
  return opciones.find((o) => o.nivel === 1)?.nivel ?? opciones[0]?.nivel ?? 1;
}

// Costo directo de cada elemento: el de su propio capítulo más el de los capítulos de todos sus descendientes.
// null = ni el elemento ni sus descendientes tienen capítulo.
export function costoPorElemento(elementos: ElementoEdt[], capitulos: { wbsId: string | null; subtotal: bigint }[]): Map<string, bigint | null> {
  const propio = new Map<string, bigint>();
  for (const c of capitulos) if (c.wbsId) propio.set(c.wbsId, (propio.get(c.wbsId) ?? 0n) + c.subtotal);
  const hijos = new Map<string, string[]>();
  for (const e of elementos) if (e.padre_id) hijos.set(e.padre_id, [...(hijos.get(e.padre_id) ?? []), e.id]);
  const memo = new Map<string, bigint | null>();
  const calcular = (id: string, prof = 0): bigint | null => {
    if (memo.has(id)) return memo.get(id) ?? null;
    let total: bigint | null = propio.has(id) ? propio.get(id)! : null;
    if (prof < 60) for (const h of hijos.get(id) ?? []) {
      const c = calcular(h, prof + 1);
      if (c !== null) total = (total ?? 0n) + c;
    }
    memo.set(id, total);
    return total;
  };
  return new Map(elementos.map((e) => [e.id, calcular(e.id)]));
}
