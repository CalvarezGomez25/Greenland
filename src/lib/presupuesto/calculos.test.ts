import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { calcularPresupuesto, presupuestoDesdeImportacion, type LineaCosto, type Partida } from "./calculos";
import { leerCsvPresupuesto } from "./csv";
import { aEscalado, formatearPesos } from "./dinero";

const pesos = (n: number | string) => BigInt(n) * 1_000_000n; // monto en escala 6

function presupuestoDeEjemplo(lineas: LineaCosto[] = []) {
  const csv = readFileSync(resolve(process.cwd(), "ejemplos", "presupuesto-ejemplo.csv"), "utf8");
  const { filas, errores } = leerCsvPresupuesto(csv);
  expect(errores).toEqual([]);
  return calcularPresupuesto({ ...presupuestoDesdeImportacion(filas), lineas });
}

const linea = (
  id: string,
  nombre: string,
  porcentaje: string,
  orden: number,
  sobre: string | null = null,
): LineaCosto => ({
  id,
  nombre,
  base: sobre ? "linea" : "costo_directo",
  lineaBaseId: sobre,
  porcentaje: aEscalado(porcentaje, 4),
  orden,
});

describe("costo directo del presupuesto de ejemplo (caso de la especificación)", () => {
  const p = presupuestoDeEjemplo();

  it("suma 1.231.970.000", () => {
    expect(p.costoDirecto).toBe(pesos(1_231_970_000));
    expect(formatearPesos(p.costoDirecto)).toBe("1.231.970.000");
    expect(p.costoTotal).toBe(p.costoDirecto); // sin costos adicionales
  });

  it("agrupa por capítulo en el orden de aparición, aunque las filas vengan mezcladas", () => {
    expect(p.capitulos.map((c) => c.nombre)).toEqual([
      "Preliminares",
      "Cimentación y estructura",
      "Mampostería y placas",
      "Acabados",
      "Instalaciones",
    ]);
    expect(p.capitulos.map((c) => c.codigo)).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("calcula el subtotal de cada capítulo (verificado a mano)", () => {
    expect(p.capitulos.map((c) => c.subtotal)).toEqual([
      pesos(29_200_000),
      pesos(361_270_000),
      pesos(550_200_000),
      pesos(195_300_000), // 134.400.000 + 60.900.000, partidas separadas en el archivo
      pesos(96_000_000),
    ]);
  });

  it("calcula la participación de cada capítulo (cada una redondeada a 2 decimales)", () => {
    const participaciones = p.capitulos.map((c) => c.participacion);
    expect(participaciones).toEqual([2.37, 29.32, 44.66, 15.85, 7.79]);
    // Al redondear cada cifra, la suma puede quedar en 99,99 o 100,01: es redondeo, no error.
    expect(participaciones.reduce<number>((s, x) => s + (x ?? 0), 0)).toBeCloseTo(100, 1);
    // Los subtotales (exactos) sí suman exactamente el costo directo.
    expect(p.capitulos.reduce((s, c) => s + c.subtotal, 0n)).toBe(p.costoDirecto);
  });

  it("ordena las partidas por código de forma natural dentro del capítulo", () => {
    const partida = (id: string, codigo: string): Partida => ({
      id,
      capituloId: "c",
      codigo,
      descripcion: "d",
      unidad: "u",
      cantidad: 10_000n,
      precio: 100n,
    });
    const r = calcularPresupuesto({
      capitulos: [{ id: "c", codigo: "1", nombre: "Cap", orden: 1 }],
      partidas: [partida("a", "3.10"), partida("b", "3.2"), partida("c", "3.1")],
      lineas: [],
    });
    expect(r.capitulos[0].partidas.map((x) => x.codigo)).toEqual(["3.1", "3.2", "3.10"]);
  });
});

describe("cantidades y precios con decimales", () => {
  it("multiplica sin errores de redondeo", () => {
    // 1.234,56 × 4.500,50 = 5.556.137,28 (cuenta hecha con fracciones exactas)
    const r = calcularPresupuesto({
      capitulos: [{ id: "c", codigo: "1", nombre: "Cap", orden: 1 }],
      partidas: [
        {
          id: "p",
          capituloId: "c",
          codigo: "1",
          descripcion: "d",
          unidad: "u",
          cantidad: aEscalado("1234.56", 4),
          precio: aEscalado("4500.50", 2),
        },
      ],
      lineas: [],
    });
    expect(r.costoDirecto).toBe(5_556_137_280_000n);
    expect(formatearPesos(r.costoDirecto)).toBe("5.556.137");
  });
});

describe("costos adicionales (AIU, IVA sobre la utilidad, retefuente)", () => {
  // Porcentajes ficticios, calculados a mano sobre 1.231.970.000:
  //   Administración 10 % = 123.197.000      Imprevistos 5 % = 61.598.500
  //   Utilidad 5 %        = 61.598.500       IVA 19 % de la utilidad = 11.703.715
  //   Retefuente 3,5 %    = 43.118.950       Adicionales = 301.216.665
  const lineas = [
    linea("adm", "Administración", "10", 1),
    linea("imp", "Imprevistos", "5", 2),
    linea("uti", "Utilidad", "5", 3),
    linea("iva", "IVA sobre la utilidad", "19", 4, "uti"),
    linea("ret", "Retefuente", "3.5", 5),
  ];
  const p = presupuestoDeEjemplo(lineas);

  it("calcula cada línea", () => {
    expect(p.lineas.map((l) => [l.nombre, l.valor])).toEqual([
      ["Administración", pesos(123_197_000)],
      ["Imprevistos", pesos(61_598_500)],
      ["Utilidad", pesos(61_598_500)],
      ["IVA sobre la utilidad", pesos(11_703_715)], // 19 % de la utilidad, NO del costo directo
      ["Retefuente", pesos(43_118_950)],
    ]);
  });

  it("suma los adicionales y el costo total", () => {
    expect(p.totalAdicionales).toBe(pesos(301_216_665));
    expect(p.costoTotal).toBe(pesos(1_533_186_665));
    expect(formatearPesos(p.costoTotal)).toBe("1.533.186.665");
  });

  it("no depende del orden en que se declaren las líneas", () => {
    const alReves = presupuestoDeEjemplo([...lineas].reverse());
    expect(alReves.costoTotal).toBe(p.costoTotal);
  });

  it("con todos los porcentajes en 0, el total es el costo directo", () => {
    const ceros = presupuestoDeEjemplo(lineas.map((l) => ({ ...l, porcentaje: 0n })));
    expect(ceros.totalAdicionales).toBe(0n);
    expect(ceros.costoTotal).toBe(ceros.costoDirecto);
  });

  it("acepta porcentajes con decimales", () => {
    const r = presupuestoDeEjemplo([linea("x", "X", "0.0001", 1)]); // 0,0001 %
    expect(r.lineas[0].valor).toBe(1_231_970_000n); // 1.231.970.000 × 0,000001 = 1.231,97 pesos (escala 6)
  });

  it("rechaza cálculos en círculo", () => {
    expect(() =>
      presupuestoDeEjemplo([linea("a", "A", "1", 1, "b"), linea("b", "B", "1", 2, "a")]),
    ).toThrow(/en círculo/);
    expect(() => presupuestoDeEjemplo([linea("a", "A", "1", 1, "a")])).toThrow(/en círculo/);
  });

  it("rechaza una línea apoyada en otra que no existe", () => {
    expect(() => presupuestoDeEjemplo([linea("a", "A", "1", 1, "fantasma")])).toThrow(/no existe/);
  });
});

describe("casos límite", () => {
  it("presupuesto vacío", () => {
    const r = calcularPresupuesto({ capitulos: [], partidas: [], lineas: [] });
    expect(r.costoDirecto).toBe(0n);
    expect(r.costoTotal).toBe(0n);
    expect(r.capitulos).toEqual([]);
  });

  it("capítulo sin partidas: subtotal cero y participación nula si no hay costo", () => {
    const r = calcularPresupuesto({
      capitulos: [{ id: "c", codigo: "1", nombre: "Vacío", orden: 1 }],
      partidas: [],
      lineas: [],
    });
    expect(r.capitulos[0].subtotal).toBe(0n);
    expect(r.capitulos[0].participacion).toBeNull();
  });

  it("una partida con un capítulo inexistente es un error", () => {
    expect(() =>
      calcularPresupuesto({
        capitulos: [],
        partidas: [{ id: "p", capituloId: "no-existe", codigo: "1", descripcion: "d", unidad: "u", cantidad: 1n, precio: 1n }],
        lineas: [],
      }),
    ).toThrow(/capítulo que no existe/);
  });
});
