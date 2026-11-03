import { describe, expect, it } from "vitest";
import { construirCampos, type DatosDocumento } from "./campos";

const base: DatosDocumento = {
  hoy: "2026-11-03", proyectoId: null,
  proyecto: { nombre: "Bodega norte", ubicacion: "Bello" },
  contrato: { tipo: "obra", objeto: "Construcción de la bodega", valor: 1_906_548_000_00n, consecutivo: "20260202-01", fechaFirma: "2026-02-02", fechaActaInicio: "2026-02-16", fechaFinVigente: "2026-12-15", plazoValor: 8, plazoUnidad: "meses", contratista: "Texto antiguo", ordenServicio: null },
  tercero: { razonSocial: "Constructora Ejemplo S.A.S.", nit: "900555666-1", municipio: "Medellín", direccion: null, correo: null, representante: "Persona Ficticia" },
  contratante: { razonSocial: "Sociedad Ejemplo Uno S.A.S.", nit: "900111222-3", municipio: "Manizales", correo: "contratos@ejemplo-uno.test", correoFacturacion: null, representante: "Representante Ficticio" },
  actas: [{ bruto: 100_000_000_00n, amortizacion: 10_000_000_00n, retencion: 10_000_000_00n }, { bruto: 50_000_000_00n, amortizacion: 5_000_000_00n, retencion: 5_000_000_00n }],
  modificaciones: [
    { id: "m1", tipo: "prorroga", numero: 1, fechaFirma: "2026-10-05", nuevaFechaFin: "2026-12-15", valor: 0n, descripcion: "Prórroga de dos meses", justificacion: "Lluvias", estado: "firmada" },
    { id: "m2", tipo: "adicion", numero: 1, fechaFirma: "2026-10-10", nuevaFechaFin: null, valor: 22_500_000_00n, descripcion: "Acero adicional", justificacion: null, estado: "firmada" },
    { id: "m3", tipo: "otrosi", numero: 1, fechaFirma: null, nuevaFechaFin: "2027-01-31", valor: 0n, descripcion: "Ajuste del cronograma", justificacion: "x", estado: "en_tramite" },
  ],
  parametros: [
    { ambito: "global", ambito_id: null, clave: "minuta_penal_pct", valor: "20" }, { ambito: "global", ambito_id: null, clave: "minuta_liquidacion_meses", valor: "2" },
    { ambito: "global", ambito_id: null, clave: "minuta_subsanar_dias", valor: "5" }, { ambito: "global", ambito_id: null, clave: "minuta_confid_smmlv", valor: "100" },
  ],
};

describe("construirCampos", () => {
  it("contrato, partes y valores", () => {
    const v = construirCampos(base);
    expect(v.CONTRATISTA).toBe("Constructora Ejemplo S.A.S.");
    expect(v.CONTRATISTA_NIT).toBe("900.555.666-1");
    expect(v.CONTRATANTE_RL_CALIDAD).toBe("Representante legal");
    expect(v.OBJETO).toBe("Construcción de la bodega");
    expect(v.TIPO_DOCUMENTO).toBe("Obra");
    expect(v.VALOR_NUMERO).toBe("$1.906.548.000");
    expect(v.VALOR_LETRAS).toBe("Mil novecientos seis millones quinientos cuarenta y ocho mil pesos colombianos");
    expect(v.FACTURADO).toBe("$150.000.000");
    expect(v.SALDO_POR_FACTURAR).toBe("$1.756.548.000");
    expect(v.ANTICIPO_AMORTIZADO).toBe("$15.000.000");
    expect(v.RETENCION_ACUMULADA).toBe("$15.000.000");
    expect(v.N_MODIFICACIONES).toBe("2");
    expect(v.VALOR_MODIFICACIONES).toBe("$22.500.000");
  });
  it("fechas y plazo en letras; la firma sale del contrato", () => {
    const v = construirCampos(base);
    expect([v.FIRMA_DIA, v.FIRMA_MES, v.FIRMA_ANIO]).toEqual(["2", "febrero", "2026"]);
    expect(v.ACTA_INICIO).toBe("16 de febrero de 2026");
    expect(v.FECHA_FIN_VIGENTE).toBe("15 de diciembre de 2026");
    expect(v.PLAZO).toBe("ocho (8) meses");
  });
  it("cláusulas de la minuta desde los parámetros; sin parámetro no se inventa", () => {
    const v = construirCampos(base);
    expect(v.PENAL).toBe("veinte por ciento (20 %)");
    expect(v.LIQUIDACION).toBe("dos (2) meses");
    expect(v.SUBSANAR_DIAS).toBe("cinco (5) días hábiles");
    expect(v.CONFIDENCIALIDAD).toBe("cien (100) SMMLV");
    expect(v.MULTA_DIA).toBeUndefined();
    expect(v.AVISO_TERMINACION).toBeUndefined();
  });
  it("lo que PMO360 no guarda no se resuelve", () => {
    const v = construirCampos(base);
    for (const k of ["ACTIVIDADES", "COTIZACION", "FORMA_PAGO", "INTERVENTOR", "CONTRATISTA_RL_CC", "CONTRATANTE_RL_CC", "POL_CUMPLIMIENTO", "MODALIDAD_PRECIO"]) expect(v[k]).toBeUndefined();
  });
  it("modificación: tipo, número, precio, vigencia y antecedentes (solo firmadas anteriores)", () => {
    const adicion = construirCampos({ ...base, modificacionId: "m2" });
    expect(adicion.MOD_TIPO_MAY).toBe("ADICIÓN");
    expect(adicion.MOD_REF).toBe("la adición");
    expect(adicion.MOD_REF_DE).toBe("de la adición");
    expect(adicion.MOD_NUMERO).toBe("1");
    expect(adicion.MOD_PRECIO).toBe("La presente modificación adiciona al valor del contrato la suma de $22.500.000 (veintidós millones quinientos mil pesos colombianos).");
    expect(adicion.MOD_VIGENCIA).toBe("La presente modificación no modifica el plazo del contrato.");
    expect(adicion.ANTECEDENTES).toBe("Que el 5 de octubre de 2026 se suscribió la prórroga N.° 1: Prórroga de dos meses");
    expect([adicion.FIRMA_DIA, adicion.FIRMA_MES]).toEqual(["10", "octubre"]);
    const prorroga = construirCampos({ ...base, modificacionId: "m1" });
    expect(prorroga.MOD_PRECIO).toBe("La presente modificación no modifica el valor del contrato.");
    expect(prorroga.MOD_VIGENCIA).toBe("La presente modificación amplía la vigencia del contrato hasta el 15 de diciembre de 2026.");
    expect(prorroga.ANTECEDENTES).toBe("Que el contrato no ha tenido modificaciones anteriores.");
    const tramite = construirCampos({ ...base, modificacionId: "m3" });
    expect(tramite.MOD_TIPO_MAY).toBe("OTROSÍ");
    expect(tramite.FIRMA_DIA).toBeUndefined(); // sin firmar: la fecha queda por completar
  });
  it("sin tercero ni contratante usa el nombre del contrato y deja los demás por completar", () => {
    const v = construirCampos({ ...base, tercero: null, contratante: null });
    expect(v.CONTRATISTA).toBe("Texto antiguo");
    expect(v.CONTRATISTA_NIT).toBeUndefined();
    expect(v.CONTRATANTE).toBeUndefined();
  });
});
