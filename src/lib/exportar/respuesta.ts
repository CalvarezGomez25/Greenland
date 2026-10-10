import { unstable_rethrow } from "next/navigation";
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

// Si algo falla al armar el archivo, responde con un texto claro (el botón lo muestra) en vez de una página de error.
export async function protegerDescarga(generar: () => Promise<Response>): Promise<Response> {
  try {
    return await generar();
  } catch (e) {
    // Las redirecciones, "no encontrado" y los avisos internos de Next (lecturas dinámicas) se propagan sin tocarse.
    unstable_rethrow(e);
    console.error("Fallo al generar la exportación:", e);
    return new Response(`No se pudo generar el archivo (${e instanceof Error ? e.name : "error"}). Avisa al administrador.`, { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  }
}
