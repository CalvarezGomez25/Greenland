import { aExcel } from "./excel";
import { aPdf } from "./pdf";
import type { DocExport } from "./tipos";

export type Formato = "xlsx" | "pdf";
export const formatoDe = (v: string | null): Formato => (v === "pdf" ? "pdf" : "xlsx");

// Respuesta de descarga con el nombre de archivo ya limpio.
export async function respuestaDescarga(doc: DocExport, formato: Formato, nombreBase: string): Promise<Response> {
  const nombre = `${nombreBase.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "-")}.${formato}`;
  const cuerpo = formato === "pdf" ? await aPdf(doc) : await aExcel(doc);
  return new Response(new Uint8Array(cuerpo), {
    headers: {
      "Content-Type": formato === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombre}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
