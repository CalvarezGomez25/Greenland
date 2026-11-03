"use client";

import { useState } from "react";
import { Aviso, Campo, Selector, claseBoton } from "@/components/ui";
import { comprimirImagen } from "@/lib/imagenes";
import { TIPOS_NOVEDAD } from "@/lib/obra/novedades";
import { crearClienteNavegador } from "@/lib/supabase/navegador";
import { crearNovedad, prepararSubidasNovedad } from "./acciones";


export function FormularioNovedad({ proyectoId, contratos, hoy }: { proyectoId: string; contratos: { id: string; etiqueta: string }[]; hoy: string }) {
  const [estado, setEstado] = useState<"" | "preparando" | "subiendo" | "guardando">("");
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const datos = new FormData(e.currentTarget);
    const archivos = (datos.getAll("fotos_archivos") as File[]).filter((f) => f instanceof File && f.size > 0);
    datos.delete("fotos_archivos");
    if (archivos.length > 3) return setError("Máximo 3 fotos por novedad.");
    try {
      let rutas: string[] = [];
      if (archivos.length > 0) {
        setEstado("preparando");
        const comprimidas = await Promise.all(archivos.map((f) => comprimirImagen(f)));
        const prep = await prepararSubidasNovedad(proyectoId, comprimidas.length);
        if (prep.error || !prep.subidas || !prep.novedadId) throw new Error(prep.error ?? "No se pudo preparar la subida.");
        setEstado("subiendo");
        const supabase = crearClienteNavegador();
        for (let i = 0; i < comprimidas.length; i++) {
          const { error: errSubida } = await supabase.storage.from("novedades").uploadToSignedUrl(prep.subidas[i].ruta, prep.subidas[i].token, comprimidas[i], { contentType: "image/jpeg" });
          if (errSubida) throw new Error(`No se pudo subir la foto ${i + 1}. Revisa la conexión e intenta de nuevo.`);
        }
        rutas = prep.subidas.map((s) => s.ruta);
        datos.set("novedad_id", prep.novedadId);
      }
      datos.set("fotos", JSON.stringify(rutas));
      setEstado("guardando");
      const r = await crearNovedad(proyectoId, datos);
      if (r?.error) throw new Error(r.error);
    } catch (err) {
      if (err instanceof Error && /NEXT_REDIRECT/.test(err.message)) throw err;
      setError(err instanceof Error ? err.message : "No se pudo guardar la novedad.");
      setEstado("");
    }
  }

  return (
    <form onSubmit={enviar} className="flex max-w-xl flex-col gap-4">
      <Selector etiqueta="Contrato" name="contrato_id" required defaultValue="">
        <option value="">Elige…</option>
        {contratos.map((c) => <option key={c.id} value={c.id}>{c.etiqueta}</option>)}
      </Selector>
      <Selector etiqueta="¿Qué pasó?" tema="novedad_campo" name="tipo" required defaultValue="otro">{TIPOS_NOVEDAD.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</Selector>
      <Campo etiqueta="Fecha del hecho" name="fecha" type="date" required defaultValue={hoy} max={hoy} />
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-leaf-800">Descripción</span>
        <textarea name="descripcion" rows={4} required maxLength={1000} className="w-full rounded-[10px] border border-soil-border bg-white px-3.5 py-2.5 text-[15px] font-light text-leaf-900 focus:border-leaf-500 focus:outline-none focus:ring-[3px] focus:ring-leaf-500/30" />
      </label>
      <Campo etiqueta="Fotos (hasta 3, opcional)" name="fotos_archivos" type="file" accept="image/*" multiple capture="environment" ayuda="Desde el celular puedes tomar la foto del documento o del lugar. La gerencia revisa la novedad antes de aplicarla: no cambia nada por sí sola." />
      {error && <Aviso>{error}</Aviso>}
      <div><button type="submit" disabled={estado !== ""} className={`${claseBoton.primario} disabled:opacity-60`}>{estado === "preparando" ? "Preparando fotos…" : estado === "subiendo" ? "Subiendo fotos…" : estado === "guardando" ? "Guardando…" : "Registrar novedad"}</button></div>
    </form>
  );
}
