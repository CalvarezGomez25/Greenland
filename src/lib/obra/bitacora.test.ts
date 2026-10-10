import { describe, expect, it } from "vitest";
import { resumenBitacora } from "./bitacora";

const e = (fecha: string, horas: number, retraso: string | null = null, incidente: string | null = null, inter = false) =>
  ({ fecha, es_interventoria: inter, horas_perdidas_total: horas, retraso_causa: retraso, incidente_tipo: incidente });

describe("resumen de la bitácora", () => {
  it("suma horas, cuenta retrasos e incidentes y ignora las entradas de interventoría", () => {
    const r = resumenBitacora([e("2026-02-02", 3, "clima"), e("2026-02-03", 6, "material", "casi_accidente"), e("2026-02-04", 0, null, "accidente"), e("2026-02-05", 99, "otra", null, true)]);
    expect(r).toEqual({ entradas: 3, horasPerdidas: 9, retrasos: 2, incidentes: 2, accidentes: 1, ultimaFecha: "2026-02-04" });
  });
  it("sin entradas", () => {
    expect(resumenBitacora([])).toEqual({ entradas: 0, horasPerdidas: 0, retrasos: 0, incidentes: 0, accidentes: 0, ultimaFecha: null });
  });
  it("horas como texto de la base de datos", () => {
    expect(resumenBitacora([e("2026-01-01", "2.5" as unknown as number), e("2026-01-02", "0.5" as unknown as number)]).horasPerdidas).toBe(3);
  });
});
