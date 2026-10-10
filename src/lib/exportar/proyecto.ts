// Documentos exportables de un proyecto: reporte semanal, valor ganado, cambios y contratos.
import { desdeJson } from "../presupuesto/dinero";
import { calcularEvm } from "../pmo/evm";
import { ETIQUETA_ESTADO_CAMBIO, ETIQUETA_NIVEL_CAMBIO, type EstadoCambio } from "../pmo/cambios";
import { ETIQUETA_ESTADO_ACTA, ETIQUETA_TIPO_CONTRATO, resumenContrato } from "../obra/contratos";
import type { DocExport } from "./tipos";

const pesos = (c: bigint) => Number(c / 100n);
const ESTADO_REP: Record<string, string> = { verde: "Verde - En tiempo y presupuesto", amarillo: "Amarillo - Con alertas", rojo: "Rojo - Requiere atencion" };

type Foto = { fecha_corte?: string; bac?: number | string; pv?: number | string; ev?: number | string; ac?: number | string; spi?: number | null; cpi?: number | null; avance_fisico?: number | null; avance_presupuestal?: number | null; hitos_cumplidos_semana?: number };

export function documentoReporte(p: { proyecto: string; semana: number; anio: number; fecha: string; enviado: string | null; estado: string; foto: Foto; logros: string | null; alertas: string | null; decisiones: string | null; proximos: string | null; proxima: string | null }, generado: string): DocExport {
  const f = p.foto;
  return {
    titulo: `Reporte semanal - semana ${p.semana} de ${p.anio}`,
    subtitulo: `${p.proyecto}${p.enviado ? " (enviado)" : " (borrador)"}`,
    generado,
    tablas: [
      {
        titulo: "Indicadores",
        nota: p.enviado ? "Foto de los indicadores al enviar el reporte (histórico, no se recalcula)." : "Indicadores actuales: se fijarán al enviar.",
        columnas: ["Indicador", "Valor"],
        filas: [
          ["Estado general reportado", ESTADO_REP[p.estado] ?? p.estado], ["Fecha del reporte", p.fecha], ["Medición de valor ganado", f.fecha_corte ?? "—"],
          ["SPI", f.spi ?? null], ["CPI", f.cpi ?? null], ["Avance físico %", f.avance_fisico ?? null], ["Avance presupuestal %", f.avance_presupuestal ?? null],
          ["Ejecutado - AC (COP)", f.ac !== undefined ? Number(f.ac) : null], ["Hitos cumplidos en la semana", f.hitos_cumplidos_semana ?? 0],
        ],
        formato: ["texto", "decimal2"],
      },
      {
        titulo: "Contenido del reporte",
        columnas: ["Sección", "Texto"],
        filas: [["Logros de la semana", p.logros ?? "—"], ["Alertas y riesgos activos", p.alertas ?? "—"], ["Decisiones requeridas de la dirección", p.decisiones ?? "—"], ["Próximos hitos (2 semanas)", p.proximos ?? "—"], ["Próxima revisión", p.proxima ?? "—"]],
      },
    ],
  };
}

export function documentoEvm(proyecto: string, filas: { fecha_corte: string; origen: string; bac: number | string; pv: number | string; ev: number | string; ac: number | string }[], generado: string): DocExport {
  return {
    titulo: "Valor ganado (EVM)", subtitulo: proyecto, generado,
    tablas: [{
      titulo: "Historial de mediciones",
      nota: "SPI = EV / PV. CPI = EV / AC. EAC = BAC / CPI. TCPI = (BAC - EV) / (BAC - AC). Montos en pesos colombianos (COP).",
      columnas: ["Corte", "Origen", "BAC", "PV", "EV", "AC", "SPI", "CPI", "SV", "CV", "EAC", "ETC", "TCPI", "VAC", "Avance físico %", "Avance financiero %"],
      filas: filas.map((x) => {
        const m = { bac: desdeJson(x.bac, 2), pv: desdeJson(x.pv, 2), ev: desdeJson(x.ev, 2), ac: desdeJson(x.ac, 2) };
        const r = calcularEvm(m);
        return [x.fecha_corte, x.origen === "calculado" ? "Calculado" : "Manual", pesos(m.bac), pesos(m.pv), pesos(m.ev), pesos(m.ac), r.spi, r.cpi, pesos(r.sv), pesos(r.cv), r.eac === null ? null : pesos(r.eac), r.etc === null ? null : pesos(r.etc), r.tcpi, r.vac === null ? null : pesos(r.vac), r.avanceFisico, r.avanceFinanciero];
      }),
      formato: ["texto", "texto", "pesos", "pesos", "pesos", "pesos", "decimal2", "decimal2", "pesos", "pesos", "pesos", "pesos", "decimal2", "pesos", "porcentaje", "porcentaje"],
    }],
  };
}

export function documentoCambios(proyecto: string, filas: { codigo: string; fecha_solicitud: string; tipo: string; descripcion_despues: string; impacto_costo: number | string; impacto_dias: number; nivel: string | null; variacion_pct: number | string | null; estado_flujo: string; detectado_sin_formato: boolean }[], generado: string): DocExport {
  return {
    titulo: "Control de cambios", subtitulo: proyecto, generado,
    tablas: [{
      titulo: "Registro de cambios",
      columnas: ["Código", "Fecha", "Tipo", "Descripción", "Impacto en costo (COP)", "Impacto en días", "Nivel", "Variación %", "Estado", "Sin formato"],
      filas: filas.map((c) => [c.codigo, c.fecha_solicitud, c.tipo, c.descripcion_despues, pesos(desdeJson(c.impacto_costo, 2)), c.impacto_dias, c.nivel ? ETIQUETA_NIVEL_CAMBIO[c.nivel as keyof typeof ETIQUETA_NIVEL_CAMBIO] : "—", c.variacion_pct === null ? null : Number(c.variacion_pct), ETIQUETA_ESTADO_CAMBIO[c.estado_flujo as EstadoCambio] ?? c.estado_flujo, c.detectado_sin_formato ? "Sí" : "No"]),
      formato: ["texto", "texto", "texto", "texto", "pesos", "entero", "texto", "decimal2", "texto", "texto"],
    }],
  };
}

type C = { id: string; tipo: string; contratista: string; objeto: string; valor: number | string; anticipo_pct: number | string; anticipo_valor: number | string; retencion_pct: number | string; retencion_liberada: boolean };
type A = { contrato_id: string; numero: number; fecha: string; valor_bruto: number | string; amortizacion: number | string; retencion: number | string; neto: number | string; estado: string };

export function documentoContratos(proyecto: string, contratos: C[], actas: A[], generado: string): DocExport {
  const act = (a: A) => ({ valorBruto: desdeJson(a.valor_bruto, 2), amortizacion: desdeJson(a.amortizacion, 2), retencion: desdeJson(a.retencion, 2), neto: desdeJson(a.neto, 2) });
  return {
    titulo: "Contratos y pagos", subtitulo: proyecto, generado,
    tablas: [
      {
        titulo: "Contratos",
        columnas: ["Contratista", "Tipo", "Objeto", "Valor (COP)", "Facturado", "Ejecutado %", "Anticipo autorizado", "Anticipo por amortizar", "Retención acumulada", "Retención liberada", "Desembolsado"],
        filas: contratos.map((c) => {
          const r = resumenContrato({ valor: desdeJson(c.valor, 2), anticipoPct: Number(c.anticipo_pct), anticipoValor: desdeJson(c.anticipo_valor, 2), retencionPct: Number(c.retencion_pct) }, actas.filter((a) => a.contrato_id === c.id).map(act), c.retencion_liberada);
          return [c.contratista, ETIQUETA_TIPO_CONTRATO[c.tipo] ?? c.tipo, c.objeto, pesos(desdeJson(c.valor, 2)), pesos(r.facturado), r.ejecutadoPct, pesos(desdeJson(c.anticipo_valor, 2)), pesos(r.anticipoPendiente), pesos(r.retenido), c.retencion_liberada ? "Sí" : "No", pesos(r.desembolsado)];
        }),
        formato: ["texto", "texto", "texto", "pesos", "pesos", "porcentaje", "pesos", "pesos", "pesos", "texto", "pesos"],
      },
      {
        titulo: "Actas de pago",
        columnas: ["Contratista", "N.º", "Fecha", "Bruto", "Amortización", "Retención", "Neto a pagar", "Estado"],
        filas: actas.map((a) => [contratos.find((c) => c.id === a.contrato_id)?.contratista ?? "—", a.numero, a.fecha, pesos(desdeJson(a.valor_bruto, 2)), pesos(desdeJson(a.amortizacion, 2)), pesos(desdeJson(a.retencion, 2)), pesos(desdeJson(a.neto, 2)), ETIQUETA_ESTADO_ACTA[a.estado] ?? a.estado]),
        formato: ["texto", "entero", "texto", "pesos", "pesos", "pesos", "pesos", "texto"],
      },
    ],
  };
}
