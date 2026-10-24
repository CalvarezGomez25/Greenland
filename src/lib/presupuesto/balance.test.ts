import { describe, expect, it } from "vitest";
import { calcularPresupuesto } from "./calculos";
import { calcularBalance, estadoDeAdicional, type AdicionalDato, type ContratoDato } from "./balance";

const pesos = (n: number) => BigInt(n) * 1_000_000n; // escala 6
const cap = (id: string, codigo: string, nombre: string, orden: number) => ({ id, codigo, nombre, orden });
const partida = (id: string, capituloId: string, valor: number) => ({ id, capituloId, codigo: id, descripcion: id, unidad: "gl", cantidad: 10_000n, precio: BigInt(valor) * 100n });

// Directo: Cimentación 100 M, Estructura 300 M = 400 M. Indirectos: A 10 %, I 5 %, U 5 % → +80 M = 480 M (factor 1,2).
const presupuesto = calcularPresupuesto({
  capitulos: [cap("c1", "1", "Cimentación", 1), cap("c2", "2", "Estructura", 2)],
  partidas: [partida("p1", "c1", 100_000_000), partida("p2", "c2", 300_000_000)],
  lineas: [
    { id: "a", nombre: "Administración", categoria: "administracion", base: "costo_directo", lineaBaseId: null, porcentaje: 100_000n, orden: 1 },
    { id: "i", nombre: "Imprevistos", categoria: "imprevistos", base: "costo_directo", lineaBaseId: null, porcentaje: 50_000n, orden: 2 },
    { id: "u", nombre: "Utilidad", categoria: "utilidad", base: "costo_directo", lineaBaseId: null, porcentaje: 50_000n, orden: 3 },
  ],
});
const contrato = (id: string, valor: number, extra: Partial<ContratoDato> = {}): ContratoDato => ({ id, contratista: id, tipo: "obra", valor: pesos(valor), aprobado: true, facturado: 0n, ...extra });
const adicional = (id: string, valor: number, extra: Partial<AdicionalDato> = {}): AdicionalDato => ({
  id, codigo: id.toUpperCase(), descripcion: id, origen: "anadidura", valorDirecto: pesos(valor), aplicaIndirectos: true, estado: "aprobado", cambioCodigo: null, ...extra,
});

describe("presupuesto: costos indirectos (A.I.U.)", () => {
  it("separa A, I y U y deja los impuestos y otros aparte", () => {
    expect(presupuesto.costoDirecto).toBe(pesos(400_000_000));
    expect(presupuesto.aiu).toEqual({ administracion: pesos(40_000_000), imprevistos: pesos(20_000_000), utilidad: pesos(20_000_000), total: pesos(80_000_000) });
    expect(presupuesto.impuestosYOtros).toBe(0n);
    expect(presupuesto.totalIndirectos).toBe(pesos(80_000_000));
    expect(presupuesto.costoTotal).toBe(pesos(480_000_000));
  });
  it("una línea sin categoría cuenta como «otro» y no entra en el A.I.U.", () => {
    const p = calcularPresupuesto({
      capitulos: [cap("c1", "1", "Todo", 1)], partidas: [partida("p1", "c1", 100_000_000)],
      lineas: [{ id: "x", nombre: "Retefuente", base: "costo_directo", lineaBaseId: null, porcentaje: 35_000n, orden: 1 }],
    });
    expect(p.aiu.total).toBe(0n);
    expect(p.impuestosYOtros).toBe(pesos(3_500_000));
  });
});

describe("estado de un adicional", () => {
  it("sale del cambio ligado", () => {
    expect(estadoDeAdicional(null)).toBe("identificado");
    expect(estadoDeAdicional("aprobacion")).toBe("identificado");
    expect(estadoDeAdicional("aprobado")).toBe("aprobado");
    expect(estadoDeAdicional("implementacion")).toBe("aprobado");
    expect(estadoDeAdicional("cerrado")).toBe("aprobado");
    expect(estadoDeAdicional("rechazado")).toBe("rechazado");
  });
});

describe("balance presupuesto vs contratos", () => {
  it("reparte el A.I.U. por capítulo y compara lo contratado", () => {
    const b = calcularBalance({
      presupuesto, adicionales: [],
      contratos: [contrato("k1", 300)],
      asignaciones: [{ contratoId: "k1", capituloId: "c1", adicionalId: null, valor: pesos(100) }, { contratoId: "k1", capituloId: "c2", adicionalId: null, valor: pesos(200) }],
    });
    const [c1, c2] = b.capitulos;
    expect(c1.presupuestoDirecto).toBe(pesos(100_000_000));
    expect(c1.presupuesto).toBe(pesos(120_000_000)); // con A.I.U. (×1,2)
    expect(c2.presupuesto).toBe(pesos(360_000_000));
    expect(c1.contratado).toBe(pesos(100));
    expect(c1.saldo).toBe(pesos(120_000_000) - pesos(100));
    expect(b.totalCapitulos.presupuesto).toBe(pesos(480_000_000));
  });
  it("marca el capítulo sobrecontratado y da el saldo negativo", () => {
    const b = calcularBalance({
      presupuesto, adicionales: [], contratos: [contrato("k1", 130_000_000)],
      asignaciones: [{ contratoId: "k1", capituloId: "c1", adicionalId: null, valor: pesos(130_000_000) }],
    });
    expect(b.capitulos[0].sobrecontratado).toBe(true);
    expect(b.capitulos[0].saldo).toBe(pesos(-10_000_000));
    expect(b.capitulos[0].pctContratado).toBe(108.3);
    expect(b.capitulos[1].sobrecontratado).toBe(false);
  });
  it("lo facturado de un contrato se reparte en proporción a lo asignado", () => {
    const b = calcularBalance({
      presupuesto, adicionales: [], contratos: [contrato("k1", 200_000_000, { facturado: pesos(50_000_000) })],
      asignaciones: [{ contratoId: "k1", capituloId: "c1", adicionalId: null, valor: pesos(50_000_000) }, { contratoId: "k1", capituloId: "c2", adicionalId: null, valor: pesos(150_000_000) }],
    });
    expect(b.capitulos[0].facturado).toBe(pesos(12_500_000));
    expect(b.capitulos[1].facturado).toBe(pesos(37_500_000));
  });
  it("los contratos por aprobar no cuentan como contratado", () => {
    const b = calcularBalance({
      presupuesto, adicionales: [], contratos: [contrato("k1", 100_000_000, { aprobado: false })],
      asignaciones: [{ contratoId: "k1", capituloId: "c1", adicionalId: null, valor: pesos(100_000_000) }],
    });
    expect(b.capitulos[0].contratado).toBe(0n);
    expect(b.capitulos[0].porAprobar).toBe(pesos(100_000_000));
    expect(b.totalSinAsignar).toBe(0n); // pendiente: no se cuenta
  });
  it("adicionales: solo los aprobados suman al total; los demás se muestran como en trámite", () => {
    const b = calcularBalance({
      presupuesto,
      adicionales: [adicional("ad1", 10_000_000), adicional("ad2", 5_000_000, { estado: "identificado" }), adicional("ad3", 1_000_000, { estado: "rechazado" }), adicional("ad4", 10_000_000, { aplicaIndirectos: false })],
      contratos: [], asignaciones: [],
    });
    expect(b.adicionales.find((f) => f.id === "ad1")!.presupuesto).toBe(pesos(12_000_000)); // 10 M con A.I.U.
    expect(b.adicionales.find((f) => f.id === "ad4")!.presupuesto).toBe(pesos(10_000_000)); // sin A.I.U.
    expect(b.totalAdicionalesAprobados.presupuesto).toBe(pesos(22_000_000));
    expect(b.adicionalesEnTramite).toBe(pesos(6_000_000));
    expect(b.total.presupuesto).toBe(pesos(480_000_000) + pesos(22_000_000));
  });
  it("contrato a un adicional: se compara con el valor del adicional", () => {
    const b = calcularBalance({
      presupuesto, adicionales: [adicional("ad1", 10_000_000)], contratos: [contrato("k1", 12_000_000)],
      asignaciones: [{ contratoId: "k1", capituloId: null, adicionalId: "ad1", valor: pesos(12_000_000) }],
    });
    const ad = b.adicionales[0];
    expect(ad.contratado).toBe(pesos(12_000_000));
    expect(ad.saldo).toBe(0n);
    expect(ad.sobrecontratado).toBe(false);
  });
  it("lo no asignado de cada contrato queda aparte (interventoría y otros sin capítulo)", () => {
    const b = calcularBalance({
      presupuesto, adicionales: [],
      contratos: [contrato("k1", 100_000_000), contrato("k2", 20_000_000, { tipo: "interventoria" })],
      asignaciones: [{ contratoId: "k1", capituloId: "c1", adicionalId: null, valor: pesos(60_000_000) }],
    });
    expect(b.sinAsignar.map((c) => [c.contratoId, c.sinAsignar])).toEqual([["k1", pesos(40_000_000)], ["k2", pesos(20_000_000)]]);
    expect(b.totalSinAsignar).toBe(pesos(60_000_000));
  });
  it("sin costo directo no hay proporción: el presupuesto con indirectos es el mismo valor", () => {
    const vacio = calcularPresupuesto({ capitulos: [cap("c1", "1", "Vacío", 1)], partidas: [], lineas: [] });
    const b = calcularBalance({ presupuesto: vacio, adicionales: [adicional("ad1", 5)], contratos: [], asignaciones: [] });
    expect(b.capitulos[0].presupuesto).toBe(0n);
    expect(b.capitulos[0].pctContratado).toBeNull();
    expect(b.adicionales[0].presupuesto).toBe(pesos(5));
  });
});
