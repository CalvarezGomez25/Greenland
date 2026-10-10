"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Aviso, Campo, Selector, claseBoton } from "@/components/ui";
import { MAX_BYTES_DOCUMENTO, TIPOS_DOCUMENTO, tamanoLegible } from "@/lib/documentos";
import { crearClienteNavegador } from "@/lib/supabase/navegador";

type Prep = { error?: string; documentoId?: string; ruta?: string; token?: string };

// Sube el archivo directo al almacenamiento (con una dirección firmada) y después registra el documento.
export function FormularioDocumento({
  proyectoId, documentoId, nombreDocumento, tipoPermitido, vinculos, preparar, registrar, volverA,
}: {
  proyectoId: string;
  documentoId?: string; // si existe, se sube una nueva versión
  nombreDocumento?: string;
  tipoPermitido?: string; // la interventoría solo sube informes
  vinculos?: { tipo: string; id: string; etiqueta: string }[];
  preparar: (proyectoId: string, nombreArchivo: string, tamano: number, documentoId?: string) => Promise<Prep>;
  registrar: (proyectoId: string, datos: FormData) => Promise<{ error?: string }>;
  volverA: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [estado, setEstado] = useState<"" | "preparando" | "subiendo" | "guardando">("");
  const formulario = useRef<HTMLFormElement>(null);
  const ocupado = estado !== "";

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (ocupado || !formulario.current) return;
    setError(null);
    const datos = new FormData(formulario.current);
    const archivo = datos.get("archivo");
    if (!(archivo instanceof File) || archivo.size === 0) return setError("Elige el archivo a subir.");
    if (archivo.size > MAX_BYTES_DOCUMENTO) return setError(`El archivo pesa ${tamanoLegible(archivo.size)} y el máximo es 50 MB.`);
    try {
      setEstado("preparando");
      const prep = await preparar(proyectoId, archivo.name, archivo.size, documentoId);
      if (prep.error || !prep.token || !prep.ruta || !prep.documentoId) throw new Error(prep.error ?? "No se pudo preparar la subida.");
      setEstado("subiendo");
      const { error: errSubida } = await crearClienteNavegador().storage.from("documentos").uploadToSignedUrl(prep.ruta, prep.token, archivo, { contentType: archivo.type || "application/octet-stream" });
      if (errSubida) throw new Error("No se pudo subir el archivo. Revisa la conexión e intenta de nuevo.");
      datos.delete("archivo");
      datos.set("documento_id", prep.documentoId);
      datos.set("ruta", prep.ruta);
      datos.set("nombre_archivo", archivo.name);
      datos.set("tamano", String(archivo.size));
      datos.set("mime", archivo.type || "");
      if (documentoId) datos.set("nueva_version", "1");
      setEstado("guardando");
      const r = await registrar(proyectoId, datos);
      if (r?.error) throw new Error(r.error);
    } catch (err) {
      if (err instanceof Error && /NEXT_REDIRECT/.test(err.message)) throw err;
      setError(err instanceof Error ? err.message : "Algo salió mal. Intenta de nuevo.");
      setEstado("");
    }
  }

  return (
    <form ref={formulario} onSubmit={enviar} className="flex max-w-2xl flex-col gap-4">
      {!documentoId && (
        <>
          <Campo etiqueta="Nombre del documento" name="nombre" required maxLength={200} />
          <Selector etiqueta="Tipo" name="tipo" required defaultValue={tipoPermitido ?? "plano"}>
            {TIPOS_DOCUMENTO.filter(([k]) => !tipoPermitido || k === tipoPermitido).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
          </Selector>
          {vinculos && vinculos.length > 0 && (
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-leaf-800">Vincular a un registro (opcional)</span>
              <select name="vinculo" className="h-[42px] w-full rounded-[10px] border border-soil-border bg-white px-3.5 text-[15px]" onChange={(ev) => {
                const [tipo, id] = ev.target.value.split("|");
                const f = formulario.current!;
                (f.elements.namedItem("entidad_tipo") as HTMLInputElement).value = tipo ?? "";
                (f.elements.namedItem("entidad_id") as HTMLInputElement).value = id ?? "";
              }}>
                <option value="">— Sin vincular —</option>
                {vinculos.map((v) => <option key={`${v.tipo}|${v.id}`} value={`${v.tipo}|${v.id}`}>{v.etiqueta}</option>)}
              </select>
            </label>
          )}
          <input type="hidden" name="entidad_tipo" defaultValue="" /><input type="hidden" name="entidad_id" defaultValue="" />
        </>
      )}
      {documentoId && <p className="text-sm text-muted">Nueva versión de “{nombreDocumento}”. Las versiones anteriores se conservan.</p>}
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-leaf-800">Archivo (máximo 50 MB)</span>
        <input name="archivo" type="file" required className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-leaf-100 file:px-4 file:py-2.5 file:font-medium file:text-leaf-900" />
      </label>
      <Campo etiqueta={documentoId ? "Qué cambió en esta versión" : "Nota (opcional)"} name="nota" maxLength={500} required={Boolean(documentoId)} />
      {error && <Aviso>{error}</Aviso>}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={ocupado} className={claseBoton.primario}>
          {estado === "preparando" ? "Preparando…" : estado === "subiendo" ? "Subiendo archivo…" : estado === "guardando" ? "Guardando…" : documentoId ? "Subir versión" : "Subir documento"}
        </button>
        <Link href={volverA} className={claseBoton.contorno}>Cancelar</Link>
      </div>
    </form>
  );
}
