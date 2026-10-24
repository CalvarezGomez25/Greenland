// Cálculos del presupuesto: costo directo, subtotales por capítulo, costos indirectos
// (A.I.U.: administración, imprevistos y utilidad; más impuestos como el IVA sobre la utilidad
// o la retefuente) y costo total. No confundir con los «adicionales de obra» (trabajos no
// contemplados en la EDT original): esos tienen su propio módulo (ver balance.ts). Todo en aritmética exacta
// (ver dinero.ts). Las funciones no tocan la base de datos: reciben datos y devuelven
// resultados, para poder probarlas solas.

import { ESCALA, aEscalado, dividirRedondeado, porcentajeDe } from "./dinero";
import type { FilaImportada } from "./csv";

export type Capitulo = { id: string; codigo: string; nombre: string; orden: number; wbsId?: string | null }; // wbsId: elemento de la EDT al que está ligado

export type Partida = {
  id: string;
  capituloId: string;
  codigo: string;
  descripcion: string;
  unidad: string;
  cantidad: bigint; // escala 4
  precio: bigint; // escala 2
};

export type CategoriaCosto = "administracion" | "imprevistos" | "utilidad" | "impuestos" | "otro";
export const ETIQUETA_CATEGORIA: Record<CategoriaCosto, string> = {
  administracion: "Administración (A)", imprevistos: "Imprevistos (I)", utilidad: "Utilidad (U)", impuestos: "Impuestos y retenciones", otro: "Otro",
};

// Costo indirecto: un porcentaje del costo directo, o de otra línea (p. ej. IVA sobre la utilidad).
// En la base de datos la tabla se llama costos_adicionales (nombre histórico).
export type LineaCosto = {
  id: string;
  nombre: string;
  categoria?: CategoriaCosto; // sin dato se trata como «otro»
  base: "costo_directo" | "linea";
  lineaBaseId: string | null;
  porcentaje: bigint; // escala 4 (19 % = 190000n)
  orden: number;
};

export type PartidaConTotal = Partida & { total: bigint };

export type ResumenCapitulo = Capitulo & {
  partidas: PartidaConTotal[];
  subtotal: bigint;
  participacion: number | null; // % del costo directo, 2 decimales
};

export type ValorLinea = LineaCosto & { valor: bigint };

// Todos los montos están en escala 6 (ver dinero.ts).
export type Presupuesto = {
  capitulos: ResumenCapitulo[];
  costoDirecto: bigint;
  lineas: ValorLinea[];
  totalIndirectos: bigint; // todas las líneas (A.I.U. + impuestos y otros)
  aiu: { administracion: bigint; imprevistos: bigint; utilidad: bigint; total: bigint };
  impuestosYOtros: bigint;
  costoTotal: bigint;
};

const totalDePartida = (p: Pick<Partida, "cantidad" | "precio">): bigint => p.cantidad * p.precio;

const compararNatural = (a: string, b: string) => a.localeCompare(b, "es", { numeric: true });

export function calcularPresupuesto(entrada: {
  capitulos: Capitulo[];
  partidas: Partida[];
  lineas: LineaCosto[];
}): Presupuesto {
  const capitulos = [...entrada.capitulos].sort((a, b) => a.orden - b.orden);
  const idsCapitulo = new Set(capitulos.map((c) => c.id));
  for (const p of entrada.partidas) {
    if (!idsCapitulo.has(p.capituloId)) {
      throw new Error(`La partida ${p.codigo} pertenece a un capítulo que no existe.`);
    }
  }

  const resumen: ResumenCapitulo[] = capitulos.map((c) => {
    const partidas = entrada.partidas
      .filter((p) => p.capituloId === c.id)
      .sort((a, b) => compararNatural(a.codigo, b.codigo))
      .map((p) => ({ ...p, total: totalDePartida(p) }));
    const subtotal = partidas.reduce((suma, p) => suma + p.total, 0n);
    return { ...c, partidas, subtotal, participacion: null };
  });

  const costoDirecto = resumen.reduce((suma, c) => suma + c.subtotal, 0n);
  for (const c of resumen) c.participacion = porcentajeDe(c.subtotal, costoDirecto);

  const lineas = calcularLineas(entrada.lineas, costoDirecto);
  const totalIndirectos = lineas.reduce((suma, l) => suma + l.valor, 0n);
  const de = (c: CategoriaCosto) => lineas.filter((l) => (l.categoria ?? "otro") === c).reduce((suma, l) => suma + l.valor, 0n);
  const aiu = { administracion: de("administracion"), imprevistos: de("imprevistos"), utilidad: de("utilidad"), total: 0n };
  aiu.total = aiu.administracion + aiu.imprevistos + aiu.utilidad;

  return {
    capitulos: resumen,
    costoDirecto,
    lineas,
    totalIndirectos,
    aiu,
    impuestosYOtros: totalIndirectos - aiu.total,
    costoTotal: costoDirecto + totalIndirectos,
  };
}

// Lleva un valor de costo directo a «con indirectos»: aplica la misma proporción que el presupuesto
// (costo total ÷ costo directo). Sin costo directo no hay proporción y el valor queda igual.
export function conIndirectos(valorDirecto: bigint, p: Pick<Presupuesto, "costoDirecto" | "costoTotal">): bigint {
  return p.costoDirecto === 0n ? valorDirecto : dividirRedondeado(valorDirecto * p.costoTotal, p.costoDirecto);
}

function calcularLineas(lineas: LineaCosto[], costoDirecto: bigint): ValorLinea[] {
  const porId = new Map(lineas.map((l) => [l.id, l]));
  const calculadas = new Map<string, bigint>();

  // valor = base × porcentaje / 100, en escala 6
  const valorDe = (linea: LineaCosto, visitando: Set<string>): bigint => {
    const previo = calculadas.get(linea.id);
    if (previo !== undefined) return previo;
    if (visitando.has(linea.id)) {
      throw new Error(`Los costos indirectos se calculan unos sobre otros en círculo ("${linea.nombre}").`);
    }
    visitando.add(linea.id);

    let base = costoDirecto;
    if (linea.base === "linea") {
      const origen = linea.lineaBaseId ? porId.get(linea.lineaBaseId) : undefined;
      if (!origen) throw new Error(`La línea "${linea.nombre}" se calcula sobre una línea que no existe.`);
      base = valorDe(origen, visitando);
    }
    visitando.delete(linea.id);

    const valor = dividirRedondeado(base * linea.porcentaje, 100n * 10n ** BigInt(ESCALA.porcentaje));
    calculadas.set(linea.id, valor);
    return valor;
  };

  return [...lineas]
    .sort((a, b) => a.orden - b.orden)
    .map((l) => ({ ...l, valor: valorDe(l, new Set()) }));
}

// Vista previa de una importación: arma capítulos y partidas a partir de las filas ya
// validadas del CSV. Los capítulos se numeran en el orden en que aparecen por primera vez
// (igual que hace la base de datos al importar).
export function presupuestoDesdeImportacion(filas: FilaImportada[]): { capitulos: Capitulo[]; partidas: Partida[] } {
  const capitulos: Capitulo[] = [];
  const idPorNombre = new Map<string, string>();
  const partidas: Partida[] = [];

  for (const f of filas) {
    const clave = f.capitulo.toLowerCase();
    let id = idPorNombre.get(clave);
    if (!id) {
      const orden = capitulos.length + 1;
      id = `capitulo-${orden}`;
      idPorNombre.set(clave, id);
      capitulos.push({ id, codigo: String(orden), nombre: f.capitulo, orden });
    }
    partidas.push({
      id: `fila-${f.fila}`,
      capituloId: id,
      codigo: f.codigo,
      descripcion: f.descripcion,
      unidad: f.unidad,
      cantidad: aEscalado(f.cantidad, ESCALA.cantidad),
      precio: aEscalado(f.precio_unitario, ESCALA.precio),
    });
  }
  return { capitulos, partidas };
}
