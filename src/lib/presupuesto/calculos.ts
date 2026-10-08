// Cálculos del presupuesto: costo directo, subtotales por capítulo, costos adicionales
// (AIU, IVA sobre la utilidad, retefuente...) y costo total. Todo en aritmética exacta
// (ver dinero.ts). Las funciones no tocan la base de datos: reciben datos y devuelven
// resultados, para poder probarlas solas.

import { ESCALA, aEscalado, dividirRedondeado, porcentajeDe } from "./dinero";
import type { FilaImportada } from "./csv";

export type Capitulo = { id: string; codigo: string; nombre: string; orden: number };

export type Partida = {
  id: string;
  capituloId: string;
  codigo: string;
  descripcion: string;
  unidad: string;
  cantidad: bigint; // escala 4
  precio: bigint; // escala 2
};

// Costo adicional: un porcentaje del costo directo, o de otra línea (p. ej. IVA sobre la utilidad).
export type LineaCosto = {
  id: string;
  nombre: string;
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
  totalAdicionales: bigint;
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
  const totalAdicionales = lineas.reduce((suma, l) => suma + l.valor, 0n);

  return {
    capitulos: resumen,
    costoDirecto,
    lineas,
    totalAdicionales,
    costoTotal: costoDirecto + totalAdicionales,
  };
}

function calcularLineas(lineas: LineaCosto[], costoDirecto: bigint): ValorLinea[] {
  const porId = new Map(lineas.map((l) => [l.id, l]));
  const calculadas = new Map<string, bigint>();

  // valor = base × porcentaje / 100, en escala 6
  const valorDe = (linea: LineaCosto, visitando: Set<string>): bigint => {
    const previo = calculadas.get(linea.id);
    if (previo !== undefined) return previo;
    if (visitando.has(linea.id)) {
      throw new Error(`Los costos adicionales se calculan unos sobre otros en círculo ("${linea.nombre}").`);
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
