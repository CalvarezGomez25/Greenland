// Documento exportable: una o varias tablas. El mismo documento se vuelca a Excel y a PDF.
export type Celda = string | number | null;
export type Formato = "texto" | "entero" | "pesos" | "decimal2" | "porcentaje";
export type Tono = "verde" | "amarillo" | "naranja" | "rojo" | "gris";
export type TablaExport = {
  titulo: string;
  nota?: string;
  columnas: string[];
  filas: Celda[][];
  formato?: Formato[]; // por columna; por defecto texto
  formatoFilas?: Formato[]; // por fila (para tablas «Indicador / Valor» donde cada fila tiene su propio formato); prevalece sobre `formato`
  insignias?: number[]; // columnas cuyo texto (Verde, Rojo, Crítico, Sí…) se dibuja como etiqueta de color
  omitirEnPdf?: boolean; // el PDF ya lo muestra de otra forma (por ejemplo, como tarjetas)
};
// Indicador destacado del PDF: etiqueta, valor ya formateado y, si hace falta, una línea de detalle y un color.
export type Tarjeta = { etiqueta: string; valor: string; detalle?: string; tono?: Tono };
export type DocExport = {
  titulo: string;
  subtitulo?: string;
  generado: string;
  tablas: TablaExport[];
  tarjetas?: Tarjeta[][]; // filas de tarjetas, solo en el PDF (en Excel las cifras están en las tablas)
  notaTarjetas?: string;
};
