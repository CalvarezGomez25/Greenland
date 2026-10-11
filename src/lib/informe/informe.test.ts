import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import ExcelJS from "exceljs";
import { causasSemaforo, fechaCorta, pesosCorto, puntosPrincipales, recortar, resumenPortafolio, type InformeProyecto } from "./modelo";
import { repartirInformes } from "./destinatarios";
import { componerInformeSemanal, MAX_PROYECTOS_CON_EXCEL } from "./correo";
import { informeAPdf } from "./pdf";
import { informeAExcel } from "./excel";
import { INFORME_MUESTRA } from "./muestra";

const vacio = (): InformeProyecto => ({
  ...INFORME_MUESTRA,
  semaforo: { general: null, spi: null, cpi: null, riesgos: null, cambios: "verde" },
  spi: null, cpi: null, avanceFisico: null, avancePlan: null, avanceFinanciero: null, bac: null, pv: null, ev: null, ac: null, eac: null, corteEvm: null,
  riesgos: { activos: 0, criticos: 0, altos: 0, medios: 0, bajos: 0, principales: [] },
  cambios: { pendientes: 0, criticos: 0, lista: [] }, hitos: { vencidos: [], proximos: [] }, reporte: null, decisiones: [],
});
const otro = (id: string, codigo: string, color: "verde" | "amarillo" | "rojo" = "verde"): InformeProyecto => ({
  ...INFORME_MUESTRA, proyecto: { ...INFORME_MUESTRA.proyecto, id, codigo, nombre: `Obra ${codigo}` }, semaforo: { ...INFORME_MUESTRA.semaforo, general: color },
});

describe("formatos", () => {
  it("abrevia pesos", () => {
    expect(pesosCorto(18_450_000_000)).toBe("$ 18.450 M");
    expect(pesosCorto(1_234_500)).toBe("$ 1,2 M");
    expect(pesosCorto(850_000)).toBe("$ 850.000");
    expect(pesosCorto(-360_000_000)).toBe("-$ 360 M");
    expect(pesosCorto(null)).toBe("—");
  });
  it("fecha corta y recorte", () => {
    expect(fechaCorta("2026-10-09")).toBe("9 oct 2026");
    expect(fechaCorta(null)).toBe("—");
    expect(recortar("  una   frase\nlarga ", 8)).toBe("una fra…");
  });
});

describe("puntos principales", () => {
  it("explica el estado con sus causas reales", () => {
    expect(causasSemaforo(INFORME_MUESTRA)).toEqual(["5 riesgo(s) crítico(s) activo(s)"]);
    const p = puntosPrincipales(INFORME_MUESTRA);
    expect(p[0]).toBe("Estado general: Rojo — por 5 riesgo(s) crítico(s) activo(s).");
    expect(p.join(" ")).toContain("41 riesgo(s) activo(s): 5 crítico(s), 23 alto(s), 13 medio(s), 0 bajo(s)");
    expect(p.join(" ")).toContain("1 hito(s) vencido(s)");
  });
  it("sin datos no inventa nada", () => {
    const p = puntosPrincipales(vacio());
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(/sin datos suficientes/);
  });
  it("resume el portafolio", () => {
    expect(resumenPortafolio([otro("a", "GL-001", "rojo"), otro("b", "GL-002"), vacio()])).toEqual({ total: 3, verdes: 1, amarillos: 0, rojos: 1, sinDatos: 1 });
  });
});

describe("destinatarios", () => {
  const perfiles = [
    { id: "dir", nombre: "Diego", correo: "dir@x.co", rol_global: "director_general" },
    { id: "ger", nombre: "Gloria", correo: "ger@x.co", rol_global: null },
    { id: "int", nombre: "Ines", correo: "int@x.co", rol_global: null },
    { id: "sin", nombre: "Sin proyecto", correo: "sin@x.co", rol_global: null },
    { id: "mal", nombre: "Mal correo", correo: "no-es-correo", rol_global: "administrador" },
    { id: "bot", nombre: "Bot", correo: "Alertas@X.co", rol_global: "analista_pmo" },
    { id: "vacio", nombre: "Sin correo", correo: null, rol_global: "finanzas" },
  ];
  const miembros = [
    { proyecto_id: "p1", usuario_id: "ger", rol: "gerente" },
    { proyecto_id: "p2", usuario_id: "int", rol: "interventoria" },
    { proyecto_id: "p3", usuario_id: "ger", rol: "consulta" }, // p3 no está activo
  ];
  const r = repartirInformes(["p1", "p2"], perfiles, miembros, "alertas@x.co");
  it("roles globales reciben todo; los demás, sus proyectos", () => {
    expect(r.find((x) => x.id === "dir")?.proyectoIds).toEqual(["p1", "p2"]);
    expect(r.find((x) => x.id === "ger")?.proyectoIds).toEqual(["p1"]);
  });
  it("no reciben: interventoría, sin proyectos, correo inválido o ausente, ni el usuario técnico", () => {
    expect(r.map((x) => x.id).sort()).toEqual(["dir", "ger"]);
  });
});

describe("correo semanal", () => {
  it("un proyecto: asunto con el nombre, puntos e invitación al adjunto", () => {
    const c = componerInformeSemanal({ nombre: "Ana" }, [INFORME_MUESTRA], "https://pmo.example", "2026-10-12");
    expect(c.asunto).toBe("[PMO360] Informe gerencial semanal — Planta empacadora El Silencio · semana 42");
    expect(c.texto).toContain("Hola Ana,");
    expect(c.texto).toContain("Estado general: Rojo");
    expect(c.texto).toMatch(/abre el archivo adjunto de cada proyecto \(PDF y Excel\)/);
    expect(c.html).toContain("https://pmo.example");
    expect(c.conExcel).toBe(true);
  });
  it("varios proyectos: resume el portafolio; con muchos solo PDF", () => {
    const tres = [otro("a", "GL-001", "rojo"), otro("b", "GL-002", "amarillo"), otro("c", "GL-003")];
    const c = componerInformeSemanal({ nombre: "Ana" }, tres, "https://x", "2026-10-12");
    expect(c.texto).toContain("3 proyectos activos: 1 en verde, 1 en amarillo, 1 en rojo.");
    const muchos = Array.from({ length: MAX_PROYECTOS_CON_EXCEL + 1 }, (_, k) => otro(`p${k}`, `GL-${k}`));
    const m = componerInformeSemanal({ nombre: "Ana" }, muchos, "https://x", "2026-10-12");
    expect(m.conExcel).toBe(false);
    expect(m.texto).toMatch(/el PDF adjunto de cada proyecto/);
  });
  it("escapa el HTML de los datos", () => {
    const sucio = { ...INFORME_MUESTRA, proyecto: { ...INFORME_MUESTRA.proyecto, nombre: "<script>x</script>" } };
    expect(componerInformeSemanal({ nombre: "<b>" }, [sucio], "https://x", "2026-10-12").html).not.toContain("<script>");
  });
});

describe("archivos", () => {
  it("el PDF es de una sola página, también con datos vacíos y con textos larguísimos", async () => {
    const largo = "palabra ".repeat(400);
    const extremo: InformeProyecto = {
      ...INFORME_MUESTRA,
      proyecto: { ...INFORME_MUESTRA.proyecto, nombre: largo, cliente: largo, ubicacion: largo, gerente: largo },
      riesgos: { ...INFORME_MUESTRA.riesgos, principales: Array.from({ length: 5 }, (_, k) => ({ codigo: `R-${k}`, frente: null, descripcion: largo, nivel: "critico" as const, score: 20, responsable: largo })) },
      cambios: { pendientes: 40, criticos: 2, lista: Array.from({ length: 4 }, (_, k) => ({ codigo: `CC-${k}`, descripcion: largo, estado: largo, impactoCosto: 1, nivel: "menor" })) },
      hitos: { vencidos: Array.from({ length: 3 }, () => ({ nombre: largo, fecha: "2026-01-01" })), proximos: [{ nombre: largo, fecha: "2026-12-01" }] },
      reporte: { semana: 1, anio: 2026, estado: "rojo", logros: largo, alertas: largo, decisiones: largo },
      decisiones: Array.from({ length: 9 }, () => ({ tipo: largo, detalle: largo })),
    };
    for (const i of [INFORME_MUESTRA, vacio(), extremo]) {
      const pdf = await PDFDocument.load(await informeAPdf(i));
      expect(pdf.getPageCount()).toBe(1);
    }
  });
  it("el Excel tiene una hoja, cifras numéricas y se imprime en una página", async () => {
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load((await informeAExcel(INFORME_MUESTRA)) as never);
    expect(libro.worksheets).toHaveLength(1);
    const h = libro.worksheets[0];
    expect(h.pageSetup.fitToPage).toBe(true);
    expect(h.pageSetup.fitToHeight).toBe(1);
    const valores: unknown[] = [];
    h.eachRow((f) => f.eachCell((c) => valores.push(c.value)));
    expect(valores).toContain(0.91);
    expect(valores).toContain(18_450_000_000);
    expect(valores).toContain("Planta empacadora El Silencio");
    await expect(informeAExcel(vacio())).resolves.toBeInstanceOf(Buffer);
  });
});
