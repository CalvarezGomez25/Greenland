"use client";

import { useState } from "react";

// Botones de descarga (Excel y PDF). `base` es la dirección de exportación (puede ya traer parámetros).
// La descarga se pide con fetch para poder mostrar el motivo si falla (un enlace directo falla en silencio
// en algunos navegadores del celular) y luego se entrega el archivo con su nombre.
type Formato = "xlsx" | "pdf";

function nombreDe(cabecera: string | null, formato: Formato): string {
  const m = cabecera?.match(/filename="?([^";]+)"?/i);
  return m?.[1] ?? `exportacion.${formato}`;
}

export function BotonesExportar({ base }: { base: string }) {
  const [trabajando, setTrabajando] = useState<Formato | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sep = base.includes("?") ? "&" : "?";
  const clase = "inline-flex h-9 items-center rounded-full border-[1.5px] border-leaf-600 px-4 text-sm font-medium text-leaf-600 hover:bg-leaf-50 disabled:opacity-60";

  async function descargar(formato: Formato) {
    const url = `${base}${sep}formato=${formato}`;
    setError(null);
    setTrabajando(formato);
    try {
      const r = await fetch(url, { credentials: "same-origin", cache: "no-store" });
      const tipo = r.headers.get("content-type") ?? "";
      if (!r.ok || tipo.includes("text/html")) {
        // sesión vencida (redirige al ingreso) o error del servidor
        const texto = r.ok ? "Tu sesión venció. Vuelve a iniciar sesión." : (await r.text()).slice(0, 300);
        throw new Error(texto || `Error ${r.status}`);
      }
      const blob = await r.blob();
      const archivo = nombreDe(r.headers.get("content-disposition"), formato);
      const enlace = document.createElement("a");
      const objeto = URL.createObjectURL(blob);
      enlace.href = objeto;
      enlace.download = archivo;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      setTimeout(() => URL.revokeObjectURL(objeto), 60_000);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "No se pudo generar el archivo. Intenta de nuevo.");
    } finally {
      setTrabajando(null);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2" aria-label="Exportar">
      {(["xlsx", "pdf"] as const).map((f) => (
        <button key={f} type="button" className={clase} disabled={trabajando !== null} onClick={() => descargar(f)}>
          {trabajando === f ? "Generando…" : f === "xlsx" ? "Excel" : "PDF"}
        </button>
      ))}
      {error && <span role="alert" className="basis-full text-sm text-danger">No se pudo exportar: {error}</span>}
    </span>
  );
}
