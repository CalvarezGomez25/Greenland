// Documento exportable: una o varias tablas. El mismo documento se vuelca a Excel y a PDF.
export type Celda = string | number | null;
export type TablaExport = {
  titulo: string;
  nota?: string;
  columnas: string[];
  filas: Celda[][];
  formato?: ("texto" | "entero" | "pesos" | "decimal2" | "porcentaje")[]; // por columna (Excel); por defecto texto
};
export type DocExport = { titulo: string; subtitulo?: string; generado: string; tablas: TablaExport[] };
