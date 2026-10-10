// Documento exportable: una o varias tablas. El mismo documento se vuelca a Excel y a PDF.
export type Celda = string | number | null;
export type Formato = "texto" | "entero" | "pesos" | "decimal2" | "porcentaje";
export type TablaExport = {
  titulo: string;
  nota?: string;
  columnas: string[];
  filas: Celda[][];
  formato?: Formato[]; // por columna; por defecto texto
  formatoFilas?: Formato[]; // por fila (para tablas «Indicador / Valor» donde cada fila tiene su propio formato); prevalece sobre `formato`
};
export type DocExport = { titulo: string; subtitulo?: string; generado: string; tablas: TablaExport[] };
