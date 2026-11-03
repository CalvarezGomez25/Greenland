// Valores de los campos de combinación de un documento, a partir de los datos de PMO360.
// Los nombres de campo son los de las plantillas de RAÍZ (paquete del 2 de noviembre de 2026). Un campo que PMO360 aún no guarda
// (actividades, forma de pago, cédulas, pólizas como cláusula…) no se resuelve aquí: se imprime «[POR COMPLETAR]» o se escribe
// a mano antes de generar. Funciones puras (sin red).

import { formatearPesos } from "../presupuesto/dinero";
import { numeroParametro, type FilaParametro } from "../pmo/parametros";
import { ETIQUETA_TIPO_CONTRATO } from "../obra/contratos";
import { cantidadConLetras, fechaEnLetras, mesEnLetras, numeroALetras, pesosEnLetras } from "./letras";

export type DatosDocumento = {
  hoy: string;
  proyecto: { nombre: string; ubicacion: string | null };
  contrato: {
    tipo: string; objeto: string; valor: bigint; // centavos
    consecutivo: string | null; fechaFirma: string | null; fechaActaInicio: string | null; fechaFinVigente: string | null;
    plazoValor: number | null; plazoUnidad: string | null; contratista: string; ordenServicio: string | null;
  };
  tercero: { razonSocial: string; nit: string; municipio: string | null; direccion: string | null; correo: string | null; representante: string | null } | null;
  contratante: { razonSocial: string; nit: string | null; municipio: string | null; correo: string | null; correoFacturacion: string | null; representante: string | null } | null;
  actas: { bruto: bigint; amortizacion: bigint; retencion: bigint }[];
  modificaciones: { id: string; tipo: string; numero: number; fechaFirma: string | null; nuevaFechaFin: string | null; valor: bigint; descripcion: string; justificacion: string | null; estado: string }[];
  modificacionId?: string | null; // la que se documenta (ámbito «modificación»)
  parametros: FilaParametro[];
  proyectoId?: string | null;
};

const UNIDAD: Record<string, [string, string]> = { dias_calendario: ["día calendario", "días calendario"], dias_habiles: ["día hábil", "días hábiles"], meses: ["mes", "meses"] };
const TIPO_MOD: Record<string, { may: string; ref: string; refDe: string; refMay: string }> = {
  adicion: { may: "ADICIÓN", ref: "la adición", refDe: "de la adición", refMay: "LA ADICIÓN" },
  otrosi: { may: "OTROSÍ", ref: "el otrosí", refDe: "del otrosí", refMay: "EL OTROSÍ" },
  prorroga: { may: "PRÓRROGA", ref: "la prórroga", refDe: "de la prórroga", refMay: "LA PRÓRROGA" },
  suspension: { may: "SUSPENSIÓN", ref: "la suspensión", refDe: "de la suspensión", refMay: "LA SUSPENSIÓN" },
  reinicio: { may: "REINICIO", ref: "el reinicio", refDe: "del reinicio", refMay: "EL REINICIO" },
  cesion: { may: "CESIÓN", ref: "la cesión", refDe: "de la cesión", refMay: "LA CESIÓN" },
};
const dinero = (c: bigint) => `$${formatearPesos(c * 10_000n)}`;
const enteros = (c: bigint) => c / 100n;
const formatoNit = (n: string) => (n.startsWith("PEND-") ? n : n.replace(/^(\d+)(-\d)?$/, (_t, a: string, b: string | undefined) => a.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + (b ?? "")));

export function construirCampos(d: DatosDocumento): Record<string, string> {
  const v: Record<string, string> = {};
  const poner = (k: string, valor: string | null | undefined) => { if (valor !== null && valor !== undefined && valor.trim() !== "") v[k] = valor; };
  const ctx = { proyectoId: d.proyectoId ?? null, portafolioId: null };
  const c = d.contrato;
  const mod = d.modificacionId ? d.modificaciones.find((m) => m.id === d.modificacionId) : undefined;

  poner("PROYECTO", d.proyecto.nombre);
  poner("LUGAR_EJECUCION", d.proyecto.ubicacion);
  poner("OBJETO", c.objeto);
  poner("CONSECUTIVO", c.consecutivo);
  poner("TIPO_DOCUMENTO", ETIQUETA_TIPO_CONTRATO[c.tipo] ?? c.tipo);
  poner("CONTRATISTA", d.tercero?.razonSocial ?? c.contratista);
  if (d.tercero) {
    poner("CONTRATISTA_NIT", formatoNit(d.tercero.nit));
    poner("CONTRATISTA_RL", d.tercero.representante);
    poner("CONTRATISTA_CORREO", d.tercero.correo);
    poner("CONTRATISTA_DIRECCION", d.tercero.direccion);
    poner("CONTRATISTA_MUNICIPIO", d.tercero.municipio);
  }
  if (d.contratante) {
    poner("CONTRATANTE", d.contratante.razonSocial);
    poner("CONTRATANTE_NIT", d.contratante.nit ? formatoNit(d.contratante.nit) : null);
    poner("CONTRATANTE_RL", d.contratante.representante);
    if (d.contratante.representante) poner("CONTRATANTE_RL_CALIDAD", "Representante legal");
    poner("CONTRATANTE_MUNICIPIO", d.contratante.municipio);
    poner("CONTRATANTE_CORREO", d.contratante.correo);
    poner("CONTRATANTE_CORREO_FACT", d.contratante.correoFacturacion);
  }

  // Valores del contrato (el valor vigente cambia solo con cambios aprobados; las modificaciones documentan el instrumento).
  poner("VALOR_NUMERO", dinero(c.valor));
  poner("VALOR_VIGENTE", dinero(c.valor));
  poner("VALOR_LETRAS", pesosEnLetras(enteros(c.valor)));
  const firmadas = d.modificaciones.filter((m) => m.estado === "firmada");
  poner("N_MODIFICACIONES", String(firmadas.length));
  poner("VALOR_MODIFICACIONES", dinero(firmadas.reduce((t, m) => t + m.valor, 0n)));
  const facturado = d.actas.reduce((t, a) => t + a.bruto, 0n);
  poner("FACTURADO", dinero(facturado));
  poner("ANTICIPO_AMORTIZADO", dinero(d.actas.reduce((t, a) => t + a.amortizacion, 0n)));
  poner("RETENCION_ACUMULADA", dinero(d.actas.reduce((t, a) => t + a.retencion, 0n)));
  poner("SALDO_POR_FACTURAR", dinero(c.valor - facturado));

  // Fechas y plazo
  const fechaFirma = mod ? (mod.fechaFirma ?? null) : c.fechaFirma;
  const f = /^(\d{4})-(\d{2})-(\d{2})/.exec(fechaFirma ?? "");
  if (f) { poner("FIRMA_DIA", String(Number(f[3]))); poner("FIRMA_MES", mesEnLetras(Number(f[2]))); poner("FIRMA_ANIO", f[1]); }
  poner("ACTA_INICIO", fechaEnLetras(c.fechaActaInicio));
  poner("FECHA_FIN_VIGENTE", fechaEnLetras(c.fechaFinVigente));
  if (c.plazoValor && c.plazoUnidad && UNIDAD[c.plazoUnidad]) poner("PLAZO", cantidadConLetras(c.plazoValor, UNIDAD[c.plazoUnidad][c.plazoValor === 1 ? 0 : 1]));

  // Cláusulas de la minuta (parámetros)
  const n = (k: string) => numeroParametro(d.parametros, k, ctx, NaN);
  const porcentaje = n("minuta_penal_pct"), multa = n("minuta_multa_dia_pct");
  if (Number.isFinite(porcentaje)) poner("PENAL", `${numeroALetras(BigInt(Math.round(porcentaje)))} por ciento (${porcentaje} %)`);
  if (Number.isFinite(multa)) poner("MULTA_DIA", `${multa} %`);
  const smmlv = n("minuta_confid_smmlv");
  if (Number.isFinite(smmlv)) poner("CONFIDENCIALIDAD", cantidadConLetras(smmlv, "SMMLV"));
  const anios = n("minuta_confid_anios");
  if (Number.isFinite(anios)) poner("CONFID_ANIOS", cantidadConLetras(anios, anios === 1 ? "año" : "años"));
  const liq = n("minuta_liquidacion_meses");
  if (Number.isFinite(liq)) poner("LIQUIDACION", cantidadConLetras(liq, liq === 1 ? "mes" : "meses"));
  const dias = (clave: string, campo: string, unidad = ["día", "días"]) => { const x = n(clave); if (Number.isFinite(x)) poner(campo, cantidadConLetras(x, unidad[x === 1 ? 0 : 1])); };
  dias("minuta_aviso_terminacion_dias", "AVISO_TERMINACION"); dias("minuta_inicio_dias", "INICIO_DIAS"); dias("minuta_suspension_dias", "SUSPENSION_DIAS");
  dias("minuta_subsanar_dias", "SUBSANAR_DIAS", ["día hábil", "días hábiles"]);

  // Modificación documentada
  if (mod && TIPO_MOD[mod.tipo]) {
    const t = TIPO_MOD[mod.tipo];
    poner("MOD_TIPO_MAY", t.may); poner("MOD_REF", t.ref); poner("MOD_REF_DE", t.refDe); poner("MOD_REF_MAY", t.refMay);
    poner("MOD_NUMERO", String(mod.numero));
    poner("MOD_OBJETO", mod.descripcion);
    poner("MOD_JUSTIFICACION", mod.justificacion);
    poner("MOD_PRECIO", mod.valor > 0n ? `La presente modificación adiciona al valor del contrato la suma de ${dinero(mod.valor)} (${pesosEnLetras(enteros(mod.valor)).toLowerCase()}).` : "La presente modificación no modifica el valor del contrato.");
    poner("MOD_VIGENCIA", mod.nuevaFechaFin ? `La presente modificación amplía la vigencia del contrato hasta el ${fechaEnLetras(mod.nuevaFechaFin)}.` : "La presente modificación no modifica el plazo del contrato.");
    const previas = firmadas.filter((m) => m.id !== mod.id && (m.fechaFirma ?? "") <= (mod.fechaFirma ?? "9999") && m.numero !== undefined).sort((a, b) => (a.fechaFirma ?? "").localeCompare(b.fechaFirma ?? ""));
    poner("ANTECEDENTES", previas.length === 0 ? "Que el contrato no ha tenido modificaciones anteriores."
      : previas.map((m) => `Que el ${fechaEnLetras(m.fechaFirma)} se suscribió ${TIPO_MOD[m.tipo]?.ref ?? "una modificación"} N.° ${m.numero}: ${m.descripcion}`).join("\n"));
  }
  return v;
}
