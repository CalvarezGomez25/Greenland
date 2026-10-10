// Semáforo (RAG): el estado general es el PEOR de cuatro dimensiones: SPI, CPI, riesgos y cambios.
// Criterios de la especificación (sección 9). Los umbrales son parámetros, no valores fijos.

export type Color = "verde" | "amarillo" | "rojo";
export type NivelRiesgo = "critico" | "alto" | "medio" | "bajo";
export type NivelCambio = "menor" | "moderado" | "critico";

export type UmbralesSemaforo = { spiVerde: number; cpiVerde: number; spiAmarillo: number; cpiAmarillo: number };

export const UMBRALES_POR_DEFECTO: UmbralesSemaforo = { spiVerde: 0.95, cpiVerde: 0.95, spiAmarillo: 0.85, cpiAmarillo: 0.85 };

const GRAVEDAD: Record<Color, number> = { verde: 0, amarillo: 1, rojo: 2 };

export function colorIndice(valor: number | null, verde: number, amarillo: number): Color | null {
  if (valor === null) return null;
  if (valor >= verde) return "verde";
  if (valor >= amarillo) return "amarillo";
  return "rojo";
}

// Solo un riesgo Crítico activo da Rojo; Alto o Medio dan Amarillo; Bajo da Verde (decisión del usuario, S1).
export function colorRiesgos(maximo: NivelRiesgo | null): Color | null {
  if (maximo === null) return null;
  return maximo === "critico" ? "rojo" : maximo === "bajo" ? "verde" : "amarillo";
}

// Cambio crítico pendiente → Rojo; menores o moderados pendientes → Amarillo; ninguno → Verde (S9).
export function colorCambios(pendientes: NivelCambio[]): Color {
  if (pendientes.includes("critico")) return "rojo";
  return pendientes.length > 0 ? "amarillo" : "verde";
}

export type DimensionesSemaforo = {
  spi: number | null;
  cpi: number | null;
  riesgoMaximo: NivelRiesgo | null; // null = sin riesgos registrados (no cuenta)
  cambiosPendientes: NivelCambio[];
};

export type ResultadoSemaforo = { general: Color | null; spi: Color | null; cpi: Color | null; riesgos: Color | null; cambios: Color };

export function calcularSemaforo(d: DimensionesSemaforo, u: UmbralesSemaforo = UMBRALES_POR_DEFECTO): ResultadoSemaforo {
  const spi = colorIndice(d.spi, u.spiVerde, u.spiAmarillo);
  const cpi = colorIndice(d.cpi, u.cpiVerde, u.cpiAmarillo);
  const riesgos = colorRiesgos(d.riesgoMaximo);
  const cambios = colorCambios(d.cambiosPendientes);
  const evaluadas = [spi, cpi, riesgos].filter((c): c is Color => c !== null);
  // Sin ningún dato de desempeño (ni índices ni riesgos) no se emite un estado: se muestra "sin datos".
  // Los cambios pendientes solos sí cuentan: un cambio crítico pendiente es Rojo.
  const hayDatos = evaluadas.length > 0 || d.cambiosPendientes.length > 0;
  const todas = [...evaluadas, cambios];
  const general = hayDatos ? todas.reduce((peor, c) => (GRAVEDAD[c] > GRAVEDAD[peor] ? c : peor)) : null;
  return { general, spi, cpi, riesgos, cambios };
}

export const ETIQUETA_COLOR: Record<Color, string> = { verde: "Verde", amarillo: "Amarillo", rojo: "Rojo" };

// Nivel de un riesgo según su score (P × I) y los cortes configurables.
export function nivelDeRiesgo(score: number, cortes = { critico: 15, alto: 8, medio: 4 }): NivelRiesgo {
  if (score >= cortes.critico) return "critico";
  if (score >= cortes.alto) return "alto";
  if (score >= cortes.medio) return "medio";
  return "bajo";
}

const ORDEN_NIVEL: Record<NivelRiesgo, number> = { bajo: 0, medio: 1, alto: 2, critico: 3 };
export const nivelMaximo = (niveles: NivelRiesgo[]): NivelRiesgo | null =>
  niveles.length === 0 ? null : niveles.reduce((m, n) => (ORDEN_NIVEL[n] > ORDEN_NIVEL[m] ? n : m));
