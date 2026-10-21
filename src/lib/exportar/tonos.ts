// Colores de las etiquetas de estado (semáforo, nivel de riesgo, Sí / No): los mismos del informe gerencial.
import type { Tono } from "./tipos";

// Paleta de alertas 2.1 del sistema de diseño GreenLand: texto y contorno del mismo color, fondo tenue solo en celdas.
const t = (texto: string, fondo: string) => ({ fondo, borde: texto, punto: texto, texto });
export const TONOS: Record<Tono, { fondo: string; borde: string; punto: string; texto: string }> = {
  verde: t("#027001", "#e6f0e6"),
  amarillo: t("#9a5b00", "#fbefd9"),
  naranja: t("#9a5b00", "#fbefd9"),
  rojo: t("#a32a1f", "#f8e6e4"),
  gris: t("#5e5e5e", "#f2f2f2"),
};

const POR_TEXTO: Record<string, Tono> = {
  verde: "verde", bajo: "verde", "sí": "verde",
  amarillo: "amarillo", medio: "gris",
  alto: "naranja",
  rojo: "rojo", "crítico": "rojo", no: "rojo",
  "sin datos": "gris",
};

// Color de una etiqueta según su texto; null si no es una etiqueta conocida.
export function tonoDeTexto(texto: string): Tono | null {
  return POR_TEXTO[texto.trim().toLowerCase()] ?? null;
}
