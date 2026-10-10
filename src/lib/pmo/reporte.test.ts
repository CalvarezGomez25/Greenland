import { describe, expect, it } from "vitest";
import { semanaDe } from "./reporte";

describe("semana de un reporte", () => {
  it("lunes a domingo (ISO)", () => {
    expect(semanaDe("2026-04-02")).toEqual({ lunes: "2026-03-30", domingo: "2026-04-05" });
    expect(semanaDe("2026-04-05")).toEqual({ lunes: "2026-03-30", domingo: "2026-04-05" });
    expect(semanaDe("2026-04-06")).toEqual({ lunes: "2026-04-06", domingo: "2026-04-12" });
  });
});
