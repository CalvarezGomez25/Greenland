import { describe, expect, it } from "vitest";
import { ETAPAS, documentosDelTercero, minimoPoliza, ordenarPorUrgencia, parametrosDeVigilancia, semaforoContrato, topeAsamblea, type EntradaContrato, type ParametrosVigilancia } from "./vigilancia";

const P: ParametrosVigilancia = { smmlv: 1_750_905, topeSmmlv: 600, alertaDias: 30, suspensionMaxDias: 30, diasMaxEtapa: { 1: 7, 2: 5, 3: 7, 4: 5, 5: 15, 7: 60 } };
const base: EntradaContrato = { etapa: 6, fechaEtapa: "2026-09-01", fechaFin: "2027-01-31", valor: 100_000_000_00n, autorizacionAsamblea: null };
const HOY = "2026-11-03";

describe("semaforoContrato", () => {
  it("verde cuando todo está al día", () => {
    const s = semaforoContrato(base, HOY, P);
    expect(s.nivel).toBe("verde");
    expect(s.rojas).toEqual([]);
  });
  it("rojo si el plazo de ejecución ya venció", () => {
    const s = semaforoContrato({ ...base, fechaFin: "2026-10-31" }, HOY, P);
    expect(s.nivel).toBe("rojo");
    expect(s.rojas[0]).toBe("Plazo vencido hace 3 días");
  });
  it("ámbar si el plazo vence dentro de la ventana de alerta, y verde si falta más", () => {
    expect(semaforoContrato({ ...base, fechaFin: "2026-12-03" }, HOY, P).nivel).toBe("ambar"); // 30 días
    expect(semaforoContrato({ ...base, fechaFin: "2026-12-04" }, HOY, P).nivel).toBe("verde"); // 31 días
    expect(semaforoContrato({ ...base, fechaFin: HOY }, HOY, P).ambar[0]).toBe("El plazo vence hoy");
  });
  it("ámbar si en ejecución falta el dato para calcular la fecha fin", () => {
    const s = semaforoContrato({ ...base, fechaFin: null }, HOY, P);
    expect(s.nivel).toBe("ambar");
    expect(s.ambar[0]).toMatch(/acta de inicio/);
  });
  it("rojo si una etapa con límite lo excede; no si está dentro", () => {
    const e = { ...base, etapa: 4, fechaFin: null };
    expect(semaforoContrato({ ...e, fechaEtapa: "2026-10-29" }, HOY, P).nivel).toBe("verde"); // 5 días de 5
    const rojo = semaforoContrato({ ...e, fechaEtapa: "2026-10-28" }, HOY, P);
    expect(rojo.nivel).toBe("rojo");
    expect(rojo.rojas[0]).toBe("Etapa «Firmas» vencida: 6 días de 5 permitidos");
  });
  it("la ejecución no tiene límite de días en la etapa", () => {
    expect(semaforoContrato({ ...base, fechaEtapa: "2020-01-01" }, HOY, P).nivel).toBe("verde");
  });
  it("ámbar si supera el tope de asamblea sin autorización, y verde si la tiene", () => {
    const grande = { ...base, valor: 1_050_543_001_00n };
    expect(semaforoContrato(grande, HOY, P).ambar[0]).toBe("Supera 600 SMMLV sin autorización de asamblea registrada");
    expect(semaforoContrato({ ...grande, autorizacionAsamblea: "Acta 12 del 2026-05-02" }, HOY, P).nivel).toBe("verde");
    expect(semaforoContrato({ ...base, valor: 1_050_543_000_00n }, HOY, P).nivel).toBe("verde"); // justo en el tope
  });
  it("respeta el tope propio del contratante", () => {
    const e = { ...base, valor: 500_000_000_00n, topeSmmlv: 200 }; // 200 SMMLV = 350.181.000
    expect(semaforoContrato(e, HOY, P).ambar[0]).toBe("Supera 200 SMMLV sin autorización de asamblea registrada");
  });
  it("sin SMMLV configurado no se evalúa la asamblea", () => {
    expect(topeAsamblea({ ...P, smmlv: 0 })).toBeNull();
    expect(semaforoContrato({ ...base, valor: 9_999_999_999_99n }, HOY, { ...P, smmlv: 0 }).nivel).toBe("verde");
  });
  it("la asamblea solo se vigila entre las etapas 3 y 7", () => {
    const grande = { ...base, valor: 2_000_000_000_00n, fechaFin: null };
    expect(semaforoContrato({ ...grande, etapa: 2, fechaEtapa: HOY }, HOY, P).nivel).toBe("verde");
    expect(semaforoContrato({ ...grande, etapa: 8, fechaEtapa: HOY }, HOY, P).nivel).toBe("verde");
    expect(semaforoContrato({ ...grande, etapa: 4, fechaEtapa: HOY }, HOY, P).nivel).toBe("ambar");
  });
  it("rojo gana sobre ámbar y se listan ambas causas", () => {
    const s = semaforoContrato({ ...base, fechaFin: "2026-10-01", valor: 2_000_000_000_00n }, HOY, P);
    expect(s.nivel).toBe("rojo");
    expect(s.rojas.length).toBe(1);
    expect(s.ambar.length).toBe(1);
  });
  it("archivado sale del tablero", () => {
    expect(semaforoContrato({ ...base, etapa: 9, fechaFin: "2020-01-01" }, HOY, P).nivel).toBe("archivado");
  });
  it("la próxima acción sale de la etapa", () => {
    expect(semaforoContrato({ ...base, etapa: 5, fechaEtapa: HOY }, HOY, P).accion).toBe(ETAPAS[4].accion);
  });
});

describe("parametrosDeVigilancia y orden", () => {
  it("lee los parámetros y usa respaldos", () => {
    const filas = [
      { ambito: "global", ambito_id: null, clave: "smmlv_cop", valor: "1750905" },
      { ambito: "global", ambito_id: null, clave: "etapa_dias_max_4", valor: "9" },
    ];
    const p = parametrosDeVigilancia(filas);
    expect(p.smmlv).toBe(1750905);
    expect(p.topeSmmlv).toBe(600);
    expect(p.alertaDias).toBe(30);
    expect(p.diasMaxEtapa).toEqual({ 4: 9 });
  });
  it("ordena por urgencia y, dentro del nivel, por más días en la etapa", () => {
    const s = (nivel: "rojo" | "ambar" | "verde" | "archivado", d: number) => ({ semaforo: { nivel, rojas: [], ambar: [], accion: "", diasEnEtapa: d } });
    const lista = [{ id: "v", ...s("verde", 90) }, { id: "a1", ...s("ambar", 5) }, { id: "r1", ...s("rojo", 3) }, { id: "r2", ...s("rojo", 20) }, { id: "x", ...s("archivado", 999) }, { id: "a2", ...s("ambar", 40) }];
    expect(ordenarPorUrgencia(lista).map((x) => x.id)).toEqual(["r2", "r1", "a2", "a1", "v", "x"]);
  });
});

describe("suspensión, pólizas y documentos (capa 2)", () => {
  it("un contrato suspendido no alerta por plazo; ámbar hasta el máximo y rojo después", () => {
    const vencido = { ...base, fechaFin: "2026-10-01" };
    const s1 = semaforoContrato({ ...vencido, suspendidoDesde: "2026-10-20" }, HOY, P);
    expect(s1.nivel).toBe("ambar");
    expect(s1.ambar).toEqual(["Contrato suspendido hace 14 días"]);
    const s2 = semaforoContrato({ ...vencido, suspendidoDesde: "2026-10-03" }, HOY, P); // 31 días
    expect(s2.nivel).toBe("rojo");
    expect(s2.rojas[0]).toBe("Suspendido hace 31 días (máximo 30 antes de decidir)");
    expect(semaforoContrato({ ...vencido, suspendidoDesde: "2026-10-04" }, HOY, P).nivel).toBe("ambar"); // 30 días justos
  });
  it("calcula el mínimo de una póliza (porcentaje × base)", () => {
    expect(minimoPoliza(30, 727_173_092_61n)).toBe(218_151_927_78n); // 30 % de 727.173.092,61
    expect(minimoPoliza(100, 50_000_000_00n)).toBe(50_000_000_00n);
  });
  it("póliza por debajo del mínimo = rojo; igual al mínimo = verde", () => {
    const z = (valor: bigint | null) => ({ ...base, etapa: 6, polizas: [{ amparo: "Cumplimiento", estado: "activa" as const, vencimiento: "2027-06-01", valorAsegurado: valor, minimo: 30_000_000_00n }] });
    expect(semaforoContrato(z(29_999_999_99n), HOY, P).rojas[0]).toBe("Póliza «Cumplimiento» por debajo del mínimo exigido");
    expect(semaforoContrato(z(30_000_000_00n), HOY, P).nivel).toBe("verde");
    expect(semaforoContrato(z(null), HOY, P).ambar[0]).toBe("Póliza «Cumplimiento» sin valor asegurado");
  });
  it("póliza vencida = rojo, por vencer = ámbar, sin fecha = ámbar, cumplida no alerta", () => {
    const z = (vencimiento: string | null, estado: "activa" | "cumplida" = "activa") => ({ ...base, polizas: [{ amparo: "Estabilidad de la obra", estado, vencimiento, valorAsegurado: 1n, minimo: null }] });
    expect(semaforoContrato(z("2026-11-01"), HOY, P).rojas[0]).toBe("Póliza «Estabilidad de la obra» vencida hace 2 días");
    expect(semaforoContrato(z("2026-12-03"), HOY, P).ambar[0]).toBe("Póliza «Estabilidad de la obra» vence en 30 días");
    expect(semaforoContrato(z(null), HOY, P).ambar[0]).toBe("Póliza «Estabilidad de la obra» sin fecha de vencimiento");
    expect(semaforoContrato(z("2020-01-01", "cumplida"), HOY, P).nivel).toBe("verde");
  });
  it("las pólizas solo se vigilan entre las etapas 5 y 8", () => {
    const z = { ...base, polizas: [{ amparo: "Cumplimiento", estado: "activa" as const, vencimiento: "2020-01-01", valorAsegurado: 1n, minimo: null }] };
    expect(semaforoContrato({ ...z, etapa: 4, fechaEtapa: HOY, fechaFin: null }, HOY, P).nivel).toBe("verde");
    expect(semaforoContrato({ ...z, etapa: 8, fechaEtapa: HOY }, HOY, P).nivel).toBe("rojo");
  });
  it("documentos del contratista: sin soportes ámbar, vencido rojo, por vencer ámbar", () => {
    const hoy = HOY;
    const d = documentosDelTercero([{ tipo: "RUT", vencimiento: "2124-12-17" }, { tipo: "PILA", vencimiento: "2026-11-01" }, { tipo: "SG-SST", vencimiento: "2026-11-20" }], hoy, 30);
    expect(d).toEqual({ tiene: true, vencidos: ["PILA"], porVencer: [{ tipo: "SG-SST", dias: 17 }] });
    const s = semaforoContrato({ ...base, documentos: d }, HOY, P);
    expect(s.nivel).toBe("rojo");
    expect(s.rojas).toEqual(["Documento del contratista vencido: PILA"]);
    expect(s.ambar).toEqual(["Documento del contratista por vencer: SG-SST (17 días)"]);
    expect(semaforoContrato({ ...base, documentos: documentosDelTercero([], hoy, 30) }, HOY, P).ambar[0]).toBe("El contratista no tiene documentos registrados");
    expect(semaforoContrato({ ...base, documentos: null }, HOY, P).nivel).toBe("verde");
  });
});

describe("compromisos de las comunicaciones (capa 3)", () => {
  const k = (fecha: string) => [{ asunto: "Entregar pólizas", fecha }];
  it("vencido = rojo, por vencer = ámbar, lejano = verde", () => {
    expect(semaforoContrato({ ...base, compromisos: k("2026-11-01") }, HOY, P).rojas[0]).toBe("Compromiso vencido hace 2 días: Entregar pólizas");
    expect(semaforoContrato({ ...base, compromisos: k("2026-11-13") }, HOY, P).ambar[0]).toBe("Compromiso por vencer (en 10 días): Entregar pólizas");
    expect(semaforoContrato({ ...base, compromisos: k(HOY) }, HOY, P).ambar[0]).toBe("Compromiso por vencer (hoy): Entregar pólizas");
    expect(semaforoContrato({ ...base, compromisos: k("2026-12-04") }, HOY, P).nivel).toBe("verde");
    expect(semaforoContrato({ ...base, compromisos: [] }, HOY, P).nivel).toBe("verde");
  });
  it("un contrato archivado no vigila compromisos", () => {
    expect(semaforoContrato({ ...base, etapa: 9, compromisos: k("2020-01-01") }, HOY, P).nivel).toBe("archivado");
  });
});
