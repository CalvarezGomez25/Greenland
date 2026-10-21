// Colores de las etiquetas de estado (semáforo, nivel de riesgo, Sí / No): los mismos del informe gerencial.
import type { Tono } from "./tipos";

export const TONOS: Record<Tono, { fondo: string; borde: string; punto: string; texto: string }> = {
  verde: { fondo: "#e6f1d1", borde: "#7fa62e", punto: "#5d870e", texto: "#2f5517" },
  amarillo: { fondo: "#fef3c7", borde: "#f59e0b", punto: "#f59e0b", texto: "#78350f" },
  naranja: { fondo: "#ffedd5", borde: "#f97316", punto: "#f97316", texto: "#7c2d12" },
  rojo: { fondo: "#fee2e2", borde: "#ef4444", punto: "#dc2626", texto: "#7f1d1d" },
  gris: { fondo: "#f4f4f2", borde: "#dcdcd8", punto: "#9a9a95", texto: "#555552" },
};

const POR_TEXTO: Record<string, Tono> = {
  verde: "verde", bajo: "verde", "sí": "verde",
  amarillo: "amarillo", medio: "amarillo",
  alto: "naranja",
  rojo: "rojo", "crítico": "rojo", no: "rojo",
  "sin datos": "gris",
};

// Color de una etiqueta según su texto; null si no es una etiqueta conocida.
export function tonoDeTexto(texto: string): Tono | null {
  return POR_TEXTO[texto.trim().toLowerCase()] ?? null;
}
