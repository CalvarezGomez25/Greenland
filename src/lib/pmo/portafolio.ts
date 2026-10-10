// Armado del dashboard PMO (N0): una fila por proyecto y el resumen del portafolio.
// Función pura: recibe los datos ya leídos y devuelve lo que se muestra.

import { calcularEvm, sumarEvm, type EntradaEvm, type ResultadoEvm } from "./evm";
import { semanaIso } from "./formato";
import { numeroParametro, type FilaParametro } from "./parametros";
import {
  calcularSemaforo, type Color, type NivelCambio, type NivelRiesgo, type ResultadoSemaforo,
} from "./semaforo";

export type ProyectoBase = {
  id: string; nombre: string; codigo: string | null; estado: string; fase: string;
  portafolio_id: string | null; organizacion_id: string | null;
};
export type MedicionBase = EntradaEvm & { proyecto_id: string; fecha_corte: string };
export type ItemNivel<N> = { proyecto_id: string; nivel: N };

export type ReporteBase = { proyecto_id: string; semana_clave: string; estado_reportado: Color; comentario: string | null };

export type EntradaPortafolio = {
  proyectos: ProyectoBase[];
  mediciones: MedicionBase[]; // cualquier cantidad: se usa la más reciente de cada proyecto
  parametros: FilaParametro[];
  riesgosActivos: ItemNivel<NivelRiesgo>[];
  cambiosPendientes: ItemNivel<NivelCambio>[];
  ultimosReportes: ReporteBase[]; // el más reciente por proyecto
};

export type FilaPortafolio = {
  proyecto: ProyectoBase;
  medicion: MedicionBase | null;
  evm: ResultadoEvm | null;
  semaforo: ResultadoSemaforo;
  riesgoMaximo: NivelRiesgo | null;
  cambiosPendientes: number;
  cambioCriticoPendientes: number;
  reporte: ReporteBase | null;
};

export type ResumenPortafolio = {
  activos: number; verdes: number; amarillos: number; rojos: number; sinDatos: number;
  bac: bigint; ac: bigint; spi: number | null; cpi: number | null;
  corte: string | null; semana: { anio: number; semana: number } | null;
};

const ORDEN_COLOR: Record<string, number> = { rojo: 0, amarillo: 1, verde: 2, nulo: 3 };
const ORDEN_NIVEL_RIESGO: Record<NivelRiesgo, number> = { bajo: 0, medio: 1, alto: 2, critico: 3 };

export function armarPortafolio(e: EntradaPortafolio): { filas: FilaPortafolio[]; resumen: ResumenPortafolio } {
  const ultima = new Map<string, MedicionBase>();
  for (const m of e.mediciones) {
    const actual = ultima.get(m.proyecto_id);
    if (!actual || m.fecha_corte > actual.fecha_corte) ultima.set(m.proyecto_id, m);
  }

  const filas: FilaPortafolio[] = e.proyectos.map((p) => {
    const ctx = { proyectoId: p.id, portafolioId: p.portafolio_id };
    const umbrales = {
      spiVerde: numeroParametro(e.parametros, "spi_verde_min", ctx, 0.95),
      cpiVerde: numeroParametro(e.parametros, "cpi_verde_min", ctx, 0.95),
      spiAmarillo: numeroParametro(e.parametros, "spi_amarillo_min", ctx, 0.85),
      cpiAmarillo: numeroParametro(e.parametros, "cpi_amarillo_min", ctx, 0.85),
    };
    const medicion = ultima.get(p.id) ?? null;
    const evm = medicion ? calcularEvm(medicion) : null;
    const niveles = e.riesgosActivos.filter((r) => r.proyecto_id === p.id).map((r) => r.nivel);
    const riesgoMaximo = niveles.length === 0 ? null : niveles.reduce((m, n) => (ORDEN_NIVEL_RIESGO[n] > ORDEN_NIVEL_RIESGO[m] ? n : m));
    const cambios = e.cambiosPendientes.filter((c) => c.proyecto_id === p.id).map((c) => c.nivel);
    return {
      proyecto: p,
      medicion,
      evm,
      semaforo: calcularSemaforo({ spi: evm?.spi ?? null, cpi: evm?.cpi ?? null, riesgoMaximo, cambiosPendientes: cambios }, umbrales),
      riesgoMaximo,
      cambiosPendientes: cambios.length,
      cambioCriticoPendientes: cambios.filter((n) => n === "critico").length,
      reporte: e.ultimosReportes.find((r) => r.proyecto_id === p.id) ?? null,
    };
  });

  // Rojos primero, luego SPI ascendente (sin dato al final).
  filas.sort((a, b) => {
    const c = ORDEN_COLOR[a.semaforo.general ?? "nulo"] - ORDEN_COLOR[b.semaforo.general ?? "nulo"];
    if (c !== 0) return c;
    const sa = a.evm?.spi ?? Infinity, sb = b.evm?.spi ?? Infinity;
    return sa === sb ? a.proyecto.nombre.localeCompare(b.proyecto.nombre, "es") : sa - sb;
  });

  const activos = filas.filter((f) => f.proyecto.estado === "activo");
  const conMedicion = activos.filter((f) => f.medicion);
  const total = sumarEvm(conMedicion.map((f) => f.medicion as MedicionBase));
  const evmTotal = calcularEvm(total);
  const corte = conMedicion.reduce<string | null>((m, f) => (m === null || (f.medicion as MedicionBase).fecha_corte > m ? (f.medicion as MedicionBase).fecha_corte : m), null);

  return {
    filas,
    resumen: {
      activos: activos.length,
      verdes: activos.filter((f) => f.semaforo.general === "verde").length,
      amarillos: activos.filter((f) => f.semaforo.general === "amarillo").length,
      rojos: activos.filter((f) => f.semaforo.general === "rojo").length,
      sinDatos: activos.filter((f) => f.semaforo.general === null).length,
      bac: total.bac,
      ac: total.ac,
      spi: conMedicion.length ? evmTotal.spi : null,
      cpi: conMedicion.length ? evmTotal.cpi : null,
      corte,
      semana: corte ? semanaIso(corte) : null,
    },
  };
}

export type Decision = { tipo: string; proyectoId: string; proyecto: string; detalle: string; href: string };

// Bloque "Requiere decisión". Cada hito agrega aquí sus fuentes (cambios, riesgos, reportes, hitos).
export function requiereDecision(filas: FilaPortafolio[], parametros: FilaParametro[]): Decision[] {
  const out: Decision[] = [];
  for (const f of filas) {
    if (f.proyecto.estado !== "activo") continue;
    const ctx = { proyectoId: f.proyecto.id, portafolioId: f.proyecto.portafolio_id };
    const tcpiMax = numeroParametro(parametros, "tcpi_max", ctx, 1.1);
    if (f.evm?.tcpi != null && f.evm.tcpi > tcpiMax) {
      out.push({
        tipo: "TCPI alto", proyectoId: f.proyecto.id, proyecto: f.proyecto.nombre,
        detalle: `TCPI ${f.evm.tcpi.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} supera ${tcpiMax.toLocaleString("es-CO")}`,
        href: `/proyectos/${f.proyecto.id}/evm`,
      });
    }
    if (f.riesgoMaximo === "critico") {
      out.push({ tipo: "Riesgo crítico", proyectoId: f.proyecto.id, proyecto: f.proyecto.nombre, detalle: "Hay al menos un riesgo crítico activo", href: `/proyectos/${f.proyecto.id}/r/riesgos` });
    }
    if (f.cambiosPendientes > 0) {
      out.push({
        tipo: "Cambios pendientes", proyectoId: f.proyecto.id, proyecto: f.proyecto.nombre,
        detalle: `${f.cambiosPendientes} cambio(s) sin cerrar${f.cambioCriticoPendientes ? `, ${f.cambioCriticoPendientes} crítico(s)` : ""}`,
        href: `/proyectos/${f.proyecto.id}/cambios`,
      });
    }
  }
  return out;
}
