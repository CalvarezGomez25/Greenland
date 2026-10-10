import ExcelJS from "exceljs";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { aExcel, nombreHoja } from "./excel";
import { aPdf, limpiar } from "./pdf";
import { documentoDashboard } from "./dashboard";
import { documentoContratos, documentoEvm } from "./proyecto";
import { armarPortafolio } from "../pmo/portafolio";
import { calcularKpis } from "../pmo/kpis";
import type { Dashboard } from "../pmo/dashboard";
import type { DocExport } from "./tipos";

const M = (millones: number) => BigInt(Math.round(millones * 1_000_000)) * 100n;
const proy = (id: string, nombre: string) => ({ id, nombre, codigo: `GL-${id}`, estado: "activo", fase: "ejecucion", portafolio_id: null, organizacion_id: null });
const med = (id: string, bac: number, pv: number, ev: number, ac: number) => ({ proyecto_id: id, fecha_corte: "2026-03-31", bac: M(bac), pv: M(pv), ev: M(ev), ac: M(ac) });

// Caso 13.4 como dashboard
const { filas, resumen } = armarPortafolio({
  proyectos: [proy("a", "Edificio Ñandú"), proy("b", "Vía Cañón"), proy("c", "Planta")],
  mediciones: [med("a", 1000, 400, 360, 400), med("b", 600, 300, 285, 290), med("c", 800, 200, 150, 210)],
  parametros: [], riesgosActivos: [], cambiosPendientes: [], ultimosReportes: [],
});
const dash: Dashboard = { filas, resumen, decisiones: [], kpis: calcularKpis({ hitos: [], riesgos: [], cambios: [], reuniones: [], evaluaciones: [], reportes: [] }, { hoy: "2026-10-09", parametros: [] }), portafolios: [], gerentes: [], nCerrados: 0, hoy: "2026-10-09" };

describe("exportación del dashboard coincide con la pantalla (caso 13.4)", () => {
  const doc = documentoDashboard(dash, "Vigentes");
  it("las cifras del documento son las del cálculo", () => {
    const resumenT = doc.tablas[0].filas;
    expect(resumenT.find((f) => f[0] === "SPI del portafolio")?.[1]).toBeCloseTo(0.8833, 4);
    expect(resumenT.find((f) => f[0] === "BAC total (COP)")?.[1]).toBe(2_400_000_000);
    const semaforo = doc.tablas[1];
    expect(semaforo.filas.map((f) => [f[0], f[4]])).toEqual([["Planta", "Rojo"], ["Edificio Ñandú", "Amarillo"], ["Vía Cañón", "Verde"]]);
  });
  it("Excel: hojas y valores legibles de vuelta", async () => {
    const buf = await aExcel(doc);
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(buf as unknown as ArrayBuffer);
    expect(libro.worksheets.map((h) => h.name)).toEqual(["Resumen del portafolio", "Semáforo de proyectos", "Requiere decisión", "KPIs de gestión"]);
    const hoja = libro.getWorksheet("Resumen del portafolio")!;
    let spi: number | null = null;
    hoja.eachRow((r) => { if (r.getCell(1).value === "SPI del portafolio") spi = Number(r.getCell(2).value); });
    expect(spi).toBeCloseTo(0.8833, 4);
    expect(libro.getWorksheet("Semáforo de proyectos")!.getRow(6).getCell(1).value).toBe("Planta");
  });
  it("PDF: es un PDF válido con texto en español", async () => {
    const bytes = await aPdf(doc);
    expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe("%PDF-");
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(1);
  });
});

describe("PDF y Excel con muchas filas", () => {
  const grande: DocExport = {
    titulo: "Prueba", generado: "2026-10-09",
    tablas: [{ titulo: "Filas", columnas: ["N.º", "Texto largo", "Valor"], filas: Array.from({ length: 150 }, (_, i) => [i + 1, `Fila ${i + 1} con acentos áéíóú ñ y un texto bastante largo que debe partirse en varias líneas dentro de la columna sin salirse de la página`, i * 1000.5]), formato: ["entero", "texto", "decimal2"] }],
  };
  it("el PDF pasa de página sin romperse", async () => {
    const pdf = await PDFDocument.load(await aPdf(grande));
    expect(pdf.getPageCount()).toBeGreaterThan(3);
  });
  it("una celda con más texto que una hoja se reparte en varias hojas sin cortarse", async () => {
    const texto = Array.from({ length: 6000 }, (_, i) => `palabra${i}`).join(" ");
    const doc: DocExport = { titulo: "Larga", generado: "2026-10-09", tablas: [{ titulo: "Texto", columnas: ["Campo", "Contenido"], filas: [["Descripción", texto]] }] };
    const pdf = await PDFDocument.load(await aPdf(doc));
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(5);
  });
  it("símbolos fuera del alfabeto latino se sustituyen", () => {
    expect(limpiar("≥ 0,95 → 😀 – ok…")).toBe(">= 0,95 - ok...");
  });
  it("nombre de hoja válido y único", () => {
    const u = new Set<string>();
    expect(nombreHoja("Datos: 2026/10?", u)).toBe("Datos  2026 10");
    expect(nombreHoja("Datos: 2026/10?", u)).not.toBe("Datos  2026 10");
    expect(nombreHoja("x".repeat(60), new Set()).length).toBeLessThanOrEqual(31);
  });
});

describe("documentos de proyecto", () => {
  it("EVM caso 13.3", () => {
    const d = documentoEvm("Obra", [{ fecha_corte: "2026-03-31", origen: "manual", bac: 1_000_000_000, pv: 400_000_000, ev: 360_000_000, ac: 400_000_000 }], "2026-10-09");
    const f = d.tablas[0].filas[0];
    expect(f.slice(6, 9)).toEqual([0.9, 0.9, -40_000_000]);
    expect(f[10]).toBe(1_111_111_111.11); // el EAC conserva los centavos (antes se truncaba)
  });
  it("contratos caso 13.1", () => {
    const c = { id: "1", tipo: "obra", contratista: "X", objeto: "Obra", valor: 480_000_000, anticipo_pct: 20, anticipo_valor: 96_000_000, retencion_pct: 10, retencion_liberada: false };
    const a = (n: number, b: number, am: number, r: number, ne: number) => ({ contrato_id: "1", numero: n, fecha: "2026-03-31", valor_bruto: b, amortizacion: am, retencion: r, neto: ne, estado: "radicada" });
    const d = documentoContratos("Obra", [c], [a(1, 120_000_000, 24_000_000, 12_000_000, 84_000_000), a(2, 150_000_000, 30_000_000, 15_000_000, 105_000_000)], "2026-10-09");
    const f = d.tablas[0].filas[0];
    expect(f[4]).toBe(270_000_000); // facturado
    expect(f[7]).toBe(42_000_000); // anticipo por amortizar
    expect(f[10]).toBe(285_000_000); // desembolsado
  });
});
