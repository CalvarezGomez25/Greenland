// Documento del dashboard del portafolio: las mismas cifras que se ven en pantalla.
import type { Dashboard } from "../pmo/dashboard";
import { ETIQUETA_COLOR } from "../pmo/semaforo";
import { ETIQUETA_ESTADO, ETIQUETA_FASE, type EstadoProyecto, type FaseProyecto } from "../tipos";
import type { DocExport } from "./tipos";

const NIVEL: Record<string, string> = { critico: "Crítico", alto: "Alto", medio: "Medio", bajo: "Bajo" };
const num = (n: number | null) => n;
const pesos = (c: bigint) => Number(c / 100n);

export function documentoDashboard(d: Dashboard, descripcionFiltros: string): DocExport {
  const r = d.resumen;
  return {
    titulo: "Dashboard del portafolio",
    subtitulo: descripcionFiltros,
    generado: d.hoy,
    tablas: [
      {
        titulo: "Resumen del portafolio",
        nota: r.semana ? `Corte: semana ${r.semana.semana} de ${r.semana.anio} (${r.corte}). SPI y CPI se calculan sumando primero EV, PV y AC; no se promedian los índices.` : undefined,
        columnas: ["Indicador", "Valor"],
        filas: [
          ["Proyectos activos", r.activos], ["En Verde", r.verdes], ["En Amarillo", r.amarillos], ["En Rojo", r.rojos], ["Sin datos", r.sinDatos],
          ["BAC total (COP)", pesos(r.bac)], ["AC total (COP)", pesos(r.ac)], ["SPI del portafolio", num(r.spi)], ["CPI del portafolio", num(r.cpi)],
        ],
        formato: ["texto", "decimal2"],
      },
      {
        titulo: "Semáforo de proyectos",
        columnas: ["Proyecto", "Código", "Fase", "Estado del proyecto", "Estado calculado", "SPI", "CPI", "Riesgo máximo", "Cambios pendientes", "Avance físico %", "Avance presupuestal %", "Estado reportado", "BAC (COP)", "AC (COP)"],
        filas: d.filas.map((f) => [
          f.proyecto.nombre, f.proyecto.codigo, ETIQUETA_FASE[f.proyecto.fase as FaseProyecto], ETIQUETA_ESTADO[f.proyecto.estado as EstadoProyecto],
          f.semaforo.general ? ETIQUETA_COLOR[f.semaforo.general] : "Sin datos", num(f.evm?.spi ?? null), num(f.evm?.cpi ?? null),
          f.riesgoMaximo ? NIVEL[f.riesgoMaximo] : "—", f.cambiosPendientes, num(f.evm?.avanceFisico ?? null), num(f.evm?.avanceFinanciero ?? null),
          f.reporte ? ETIQUETA_COLOR[f.reporte.estado_reportado] : "—", f.medicion ? pesos(f.medicion.bac) : null, f.medicion ? pesos(f.medicion.ac) : null,
        ]),
        formato: ["texto", "texto", "texto", "texto", "texto", "decimal2", "decimal2", "texto", "entero", "porcentaje", "porcentaje", "texto", "pesos", "pesos"],
      },
      {
        titulo: "Requiere decisión",
        columnas: ["Tipo", "Proyecto", "Detalle"],
        filas: d.decisiones.map((x) => [x.tipo, x.proyecto, x.detalle]),
      },
      {
        titulo: "KPIs de gestión",
        nota: "Mensuales. Cada columna de mes muestra el valor de ese mes.",
        columnas: ["KPI", "Meta", "Actual", "Cumple", "Tendencia", ...(d.kpis[0]?.puntos.map((p) => p.mes) ?? [])],
        filas: d.kpis.map((k) => [
          k.nombre, k.meta, k.actual, k.cumple === null ? "—" : k.cumple ? "Sí" : "No",
          k.tendencia === "sube" ? "Sube" : k.tendencia === "baja" ? "Baja" : k.tendencia === "igual" ? "Igual" : "—", ...k.puntos.map((p) => p.valor),
        ]),
        formato: ["texto", "decimal2", "decimal2", "texto", "texto", ...(d.kpis[0]?.puntos.map(() => "decimal2" as const) ?? [])],
      },
    ],
  };
}

