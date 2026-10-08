import { describe, expect, it } from "vitest";
import { calcularIndicadores, gastoAMonto, planificadoAcumulado, serieCurvaS } from "./curva";
import { formatearPesos } from "./dinero";

const pesos = (n: number | string) => BigInt(n) * 1_000_000n; // monto en escala 6
const millones = (...valores: number[]) =>
  new Map(valores.map((v, i) => [i + 1, pesos(v * 1_000_000)] as const));

describe("planificadoAcumulado (3t² − 2t³)", () => {
  const T = pesos(1_000_000_000);

  it("valores conocidos en una obra de 12 meses", () => {
    expect(planificadoAcumulado(T, 0, 12)).toBe(0n);
    expect(planificadoAcumulado(T, 3, 12)).toBe(pesos(156_250_000)); // t = 1/4 → 15,625 %
    expect(planificadoAcumulado(T, 6, 12)).toBe(pesos(500_000_000)); // t = 1/2 → 50 %
    expect(planificadoAcumulado(T, 12, 12)).toBe(T);
  });

  it("no se sale del rango: antes del inicio es 0 y después del final es el total", () => {
    expect(planificadoAcumulado(T, -3, 12)).toBe(0n);
    expect(planificadoAcumulado(T, 15, 12)).toBe(T);
  });

  it("obra de 1 mes: todo al final", () => {
    expect(planificadoAcumulado(T, 0, 1)).toBe(0n);
    expect(planificadoAcumulado(T, 1, 1)).toBe(T);
  });

  it("nunca decrece y termina exactamente en el total (3, 12 y 36 meses)", () => {
    for (const n of [3, 12, 36]) {
      let anterior = -1n;
      for (let mes = 0; mes <= n; mes++) {
        const v = planificadoAcumulado(T, mes, n);
        expect(v >= anterior, `n=${n}, mes=${mes}`).toBe(true);
        anterior = v;
      }
      expect(anterior).toBe(T);
    }
  });

  it("es simétrica: lo planificado a t y a 1−t suman el total", () => {
    for (const k of [1, 2, 3, 5]) {
      expect(planificadoAcumulado(T, k, 12) + planificadoAcumulado(T, 12 - k, 12)).toBe(T);
    }
  });

  it("rechaza duraciones inválidas", () => {
    expect(() => planificadoAcumulado(T, 1, 0)).toThrow(RangeError);
    expect(() => planificadoAcumulado(T, 1, 2.5)).toThrow(RangeError);
  });
});

describe("serieCurvaS", () => {
  const total = pesos(1_231_970_000);

  it("acumula el gasto real mes a mes (datos del prototipo)", () => {
    const s = serieCurvaS({ costoTotal: total, duracion: 12, gastoPorMes: millones(45, 80, 95, 110, 100) });
    expect(s.puntos).toHaveLength(13); // meses 0 a 12
    expect(s.ultimoMes).toBe(5);
    expect(s.puntos.slice(0, 6).map((p) => p.real)).toEqual([
      0n,
      pesos(45_000_000),
      pesos(125_000_000),
      pesos(220_000_000),
      pesos(330_000_000),
      pesos(430_000_000),
    ]);
    expect(s.puntos.slice(6).every((p) => p.real === null)).toBe(true); // sin dato, no se dibuja
    expect(s.gastadoALaFecha).toBe(pesos(430_000_000));
    expect(s.mesesSinRegistro).toEqual([]);
  });

  it("la línea planificada llega al total en el último mes", () => {
    const s = serieCurvaS({ costoTotal: total, duracion: 12, gastoPorMes: new Map() });
    expect(s.puntos[0].planificado).toBe(0n);
    expect(s.puntos[12].planificado).toBe(total);
  });

  it("un mes sin registro cuenta como cero y se avisa", () => {
    const g = new Map([
      [1, pesos(10_000_000)],
      [2, pesos(20_000_000)],
      [4, pesos(30_000_000)],
    ]);
    const s = serieCurvaS({ costoTotal: total, duracion: 12, gastoPorMes: g });
    expect(s.mesesSinRegistro).toEqual([3]);
    expect(s.puntos[3].real).toBe(pesos(30_000_000)); // igual que el mes 2
    expect(s.puntos[4].real).toBe(pesos(60_000_000));
  });

  it("sin gasto registrado no hay línea real (salvo el punto de partida)", () => {
    const s = serieCurvaS({ costoTotal: total, duracion: 6, gastoPorMes: new Map() });
    expect(s.ultimoMes).toBe(0);
    expect(s.puntos[0].real).toBe(0n);
    expect(s.puntos.slice(1).every((p) => p.real === null)).toBe(true);
  });

  it("si hay gasto después de la duración, el eje se extiende y el plan queda en el total", () => {
    const g = new Map([[14, pesos(5)]]);
    const s = serieCurvaS({ costoTotal: total, duracion: 12, gastoPorMes: g });
    expect(s.puntos).toHaveLength(15);
    expect(s.puntos[14].planificado).toBe(total);
    expect(s.puntos[14].real).toBe(pesos(5));
  });
});

describe("calcularIndicadores", () => {
  const costoDirecto = pesos(1_231_970_000);

  it("avance financiero y desviación a mitad de obra (datos del prototipo, verificado con fracciones exactas)", () => {
    const i = calcularIndicadores({
      costoDirecto,
      costoTotal: costoDirecto,
      duracion: 12,
      gastoPorMes: millones(45, 80, 95, 110, 100),
    });
    expect(i.mesDeCorte).toBe(5);
    expect(i.gastadoALaFecha).toBe(pesos(430_000_000));
    expect(i.planificadoALaFecha).toBe(463_414_641_203_704n); // 1.231.970.000 × 650/1728
    expect(formatearPesos(i.planificadoALaFecha)).toBe("463.414.641");
    expect(i.avanceFinanciero).toBe(34.9); // 430 M / 1.231,97 M = 34,90 %
    expect(i.desviacion).toBe(-7.21); // gasta menos de lo planificado
  });

  it("el avance se mide sobre el costo TOTAL (con costos adicionales), no solo el directo", () => {
    const costoTotal = pesos(1_533_186_665);
    const i = calcularIndicadores({ costoDirecto, costoTotal, duracion: 12, gastoPorMes: millones(45, 80, 95, 110, 100) });
    expect(i.avanceFinanciero).toBe(28.05); // 430 M / 1.533,19 M
    expect(i.desviacion).toBe(-25.44);
  });

  it("sin gasto: avance 0 y desviación no calculable", () => {
    const i = calcularIndicadores({ costoDirecto, costoTotal: costoDirecto, duracion: 12, gastoPorMes: new Map() });
    expect(i.mesDeCorte).toBe(0);
    expect(i.avanceFinanciero).toBe(0);
    expect(i.desviacion).toBeNull();
  });

  it("presupuesto en cero: sin porcentajes", () => {
    const i = calcularIndicadores({ costoDirecto: 0n, costoTotal: 0n, duracion: 12, gastoPorMes: millones(1) });
    expect(i.avanceFinanciero).toBeNull();
    expect(i.desviacion).toBeNull();
  });

  it("gasta de más que lo planificado: desviación positiva", () => {
    const i = calcularIndicadores({ costoDirecto, costoTotal: costoDirecto, duracion: 12, gastoPorMes: millones(600) });
    expect(i.desviacion).not.toBeNull();
    expect(i.desviacion as number).toBeGreaterThan(0);
  });

  it("avisa de los meses sin registro", () => {
    const g = new Map([[1, pesos(1)], [3, pesos(1)]]);
    expect(calcularIndicadores({ costoDirecto, costoTotal: costoDirecto, duracion: 12, gastoPorMes: g }).mesesSinRegistro).toEqual([2]);
  });
});

describe("gastoAMonto", () => {
  it("convierte el gasto de la base de datos (centavos) al monto interno", () => {
    expect(gastoAMonto(4_600_000_050n)).toBe(46_000_000_500_000n); // 46.000.000,50 pesos
    expect(formatearPesos(gastoAMonto(4_600_000_050n))).toBe("46.000.001"); // .50 sube al peso siguiente
  });
});
