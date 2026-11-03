"use client";

import { useRef, useState } from "react";
import { Aviso, Campo, Selector, claseBoton } from "@/components/ui";
import { crearClienteNavegador } from "@/lib/supabase/navegador";
import { prepararSubidaPlantilla, registrarPlantilla } from "./acciones";

const MAX = 8 * 1024 * 1024;

export function FormularioSubidaPlantilla() {
  const [estado, setEstado] = useState<"" | "subiendo" | "registrando">("");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const formulario = useRef<HTMLFormElement>(null);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null); setAviso(null);
    const datos = new FormData(e.currentTarget);
    const archivo = datos.get("archivo");
    if (!(archivo instanceof File) || archivo.size === 0) return setError("Elige el archivo Word (.docx).");
    if (!/\.docx$/i.test(archivo.name)) return setError("El archivo debe ser un Word moderno (.docx).");
    if (archivo.size > MAX) return setError("El archivo es demasiado grande (máximo 8 MB).");
    try {
      setEstado("subiendo");
      const prep = await prepararSubidaPlantilla();
      if (prep.error || !prep.ruta || !prep.token) throw new Error(prep.error ?? "No se pudo preparar la subida.");
      const { error: errSubida } = await crearClienteNavegador().storage.from("plantillas").uploadToSignedUrl(prep.ruta, prep.token, archivo, { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
      if (errSubida) throw new Error("No se pudo subir el archivo. Revisa la conexión e intenta de nuevo.");
      setEstado("registrando");
      const r = await registrarPlantilla(prep.ruta, String(datos.get("nombre") ?? ""), String(datos.get("ambito") ?? ""), String(datos.get("nota") ?? ""));
      if (r.error && !/registrada, pero/.test(r.error)) throw new Error(r.error);
      if (r.error) setAviso(r.error);
      formulario.current?.reset();
      if (!r.error) window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar la plantilla.");
    } finally { setEstado(""); }
  }

  return (
    <form ref={formulario} onSubmit={enviar} className="flex max-w-2xl flex-col gap-4">
      <Campo etiqueta="Nombre de la plantilla" name="nombre" required maxLength={120} ayuda="Por ejemplo «Minuta de obra civil»." />
      <Selector etiqueta="Se usa para" name="ambito" required defaultValue="contrato"><option value="contrato">Un contrato</option><option value="modificacion">Una modificación (otrosí, adición…)</option></Selector>
      <Campo etiqueta="Archivo Word (.docx, máximo 8 MB)" name="archivo" type="file" accept=".docx" required ayuda="Debe traer campos de combinación (MERGEFIELD) con los nombres de RAÍZ, como «CONTRATISTA» u «OBJETO»." />
      <Campo etiqueta="Nota (opcional)" name="nota" maxLength={500} ayuda="Por ejemplo, la versión y quién la aprobó." />
      {error && <Aviso>{error}</Aviso>}
      {aviso && <Aviso tipo="ok">{aviso}</Aviso>}
      <div><button type="submit" disabled={estado !== ""} className={`${claseBoton.primario} disabled:opacity-60`}>{estado === "subiendo" ? "Subiendo…" : estado === "registrando" ? "Registrando…" : "Subir plantilla"}</button></div>
    </form>
  );
}
