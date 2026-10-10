"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Aviso, Campo, Selector, claseBoton } from "@/components/ui";
import { CAUSAS_RETRASO, CLIMAS, MAX_FOTOS, TIPOS_INCIDENTE } from "@/lib/obra/bitacora";
import { comprimirImagen } from "@/lib/imagenes";
import { crearClienteNavegador } from "@/lib/supabase/navegador";

type Actividad = { tarea_id: string; avance_dia_pct: string; descripcion: string };

const clase = "w-full rounded-[10px] border border-soil-border bg-white px-3.5 py-3 text-[16px] font-light text-leaf-900 focus:border-leaf-500 focus:outline-none focus:ring-[3px] focus:ring-leaf-500/30";

function Area({ nombre, etiqueta }: { nombre: string; etiqueta: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-leaf-800">{etiqueta} (opcional)</span>
      <textarea name={nombre} rows={2} maxLength={2000} className={clase} />
    </label>
  );
}

// Formulario pensado primero para celular: campos grandes, fotos desde la cámara y subida directa y comprimida.
export function FormularioBitacora({
  proyectoId, hoy, tareas, esInterventoria, preparar, guardar,
}: {
  proyectoId: string;
  hoy: string;
  tareas: { id: string; nombre: string }[];
  esInterventoria: boolean;
  preparar: (proyectoId: string, cantidad: number) => Promise<{ error?: string; bitacoraId?: string; subidas?: { ruta: string; token: string }[] }>;
  guardar: (proyectoId: string, datos: FormData) => Promise<{ error?: string }>;
}) {
  const [actividades, setActividades] = useState<Actividad[]>([{ tarea_id: "", avance_dia_pct: "", descripcion: "" }]);
  const [retraso, setRetraso] = useState(false);
  const [incidente, setIncidente] = useState(false);
  const [fotos, setFotos] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [estado, setEstado] = useState<"" | "preparando" | "subiendo" | "guardando">("");
  const formulario = useRef<HTMLFormElement>(null);
  const ocupado = estado !== "";

  const cambiar = (i: number, campo: keyof Actividad, valor: string) =>
    setActividades((l) => l.map((a, j) => (j === i ? { ...a, [campo]: valor } : a)));

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (ocupado || !formulario.current) return;
    setError(null);
    const datos = new FormData(formulario.current);
    datos.delete("archivos");
    const lista = actividades.filter((a) => a.descripcion.trim() !== "").map((a) => ({ tarea_id: a.tarea_id || null, avance_dia_pct: (a.avance_dia_pct || "0").replace(",", "."), descripcion: a.descripcion.trim() }));
    if (lista.length === 0) return setError("Registra al menos una actividad del día (con su descripción).");
    datos.set("actividades", JSON.stringify(lista));

    try {
      let rutas: string[] = [];
      if (fotos.length > 0) {
        setEstado("preparando");
        const comprimidas = await Promise.all(fotos.map((f) => comprimirImagen(f)));
        const prep = await preparar(proyectoId, comprimidas.length);
        if (prep.error || !prep.subidas || !prep.bitacoraId) throw new Error(prep.error ?? "No se pudo preparar la subida.");
        setEstado("subiendo");
        const supabase = crearClienteNavegador();
        for (let i = 0; i < comprimidas.length; i++) {
          const { error: errSubida } = await supabase.storage.from("bitacora").uploadToSignedUrl(prep.subidas[i].ruta, prep.subidas[i].token, comprimidas[i], { contentType: "image/jpeg" });
          if (errSubida) throw new Error(`No se pudo subir la foto ${i + 1}. Revisa la conexión e intenta de nuevo.`);
        }
        rutas = prep.subidas.map((s) => s.ruta);
        datos.set("bitacora_id", prep.bitacoraId);
      }
      datos.set("fotos", JSON.stringify(rutas));
      setEstado("guardando");
      const r = await guardar(proyectoId, datos);
      if (r?.error) throw new Error(r.error);
    } catch (err) {
      // redirect() de la acción también llega aquí como excepción especial: se deja pasar.
      if (err instanceof Error && /NEXT_REDIRECT/.test(err.message)) throw err;
      setError(err instanceof Error ? err.message : "Algo salió mal. Intenta de nuevo.");
      setEstado("");
    }
  }

  return (
    <form ref={formulario} onSubmit={enviar} className="flex max-w-2xl flex-col gap-5" noValidate={false}>
      {esInterventoria && <Aviso tipo="ok">Esta entrada quedará marcada como “interventoría” y no modifica el avance de las tareas.</Aviso>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Fecha" name="fecha" type="date" required defaultValue={hoy} max={hoy} />
        <Selector etiqueta="Clima" name="clima" required defaultValue="soleado">{CLIMAS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</Selector>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo etiqueta="Horas perdidas por clima" name="horas_perdidas_clima" inputMode="decimal" defaultValue="0" />
        <Campo etiqueta="Personal propio" name="personal_propio" inputMode="numeric" required />
        <Campo etiqueta="Personal de subcontratistas" name="personal_subcontratistas" inputMode="numeric" defaultValue="0" />
      </div>

      <fieldset className="flex flex-col gap-3 rounded-card border border-soil-border p-4">
        <legend className="px-1 text-sm font-medium text-leaf-800">Actividades del día</legend>
        {actividades.map((a, i) => (
          <div key={i} className="grid gap-3 rounded-[10px] bg-leaf-50 p-3 sm:grid-cols-[1fr_110px]">
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-[13px] font-medium text-leaf-800">Descripción</span>
              <textarea rows={2} maxLength={2000} value={a.descripcion} onChange={(ev) => cambiar(i, "descripcion", ev.target.value)} className={clase} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-leaf-800">Tarea del cronograma</span>
              <select value={a.tarea_id} onChange={(ev) => cambiar(i, "tarea_id", ev.target.value)} className={clase}>
                <option value="">— Otra actividad (no suma avance) —</option>
                {tareas.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-leaf-800">Avance de hoy (%)</span>
              <input inputMode="decimal" value={a.avance_dia_pct} onChange={(ev) => cambiar(i, "avance_dia_pct", ev.target.value)} className={clase} />
            </label>
            {actividades.length > 1 && <button type="button" onClick={() => setActividades((l) => l.filter((_, j) => j !== i))} className="self-start text-sm font-medium text-danger underline">Quitar actividad</button>}
          </div>
        ))}
        <button type="button" onClick={() => setActividades((l) => [...l, { tarea_id: "", avance_dia_pct: "", descripcion: "" }])} className={`${claseBoton.secundario} self-start`}>+ Otra actividad</button>
        <p className="text-xs text-muted">El avance de hoy se suma al avance de la tarea (máximo 100 %).</p>
      </fieldset>

      <fieldset className="flex flex-col gap-3 rounded-card border border-soil-border p-4">
        <legend className="px-1 text-sm font-medium text-leaf-800">Fotos de avance (hasta {MAX_FOTOS})</legend>
        <input name="archivos" type="file" accept="image/*" multiple capture="environment"
          onChange={(ev) => { const l = Array.from(ev.target.files ?? []); if (l.length > MAX_FOTOS) setError(`Máximo ${MAX_FOTOS} fotos: se tomaron las primeras ${MAX_FOTOS}.`); setFotos(l.slice(0, MAX_FOTOS)); }}
          className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-leaf-100 file:px-4 file:py-2.5 file:font-medium file:text-leaf-900" />
        {fotos.length > 0 && <p className="text-sm text-muted">{fotos.length} foto(s) lista(s); se reducen de tamaño antes de subirlas.</p>}
      </fieldset>

      <label className="flex items-center gap-3 text-[15px]"><input type="checkbox" checked={retraso} onChange={(e) => setRetraso(e.target.checked)} className="h-5 w-5" /> Hubo un retraso</label>
      {retraso && (
        <div className="grid gap-4 rounded-card bg-leaf-50 p-4 sm:grid-cols-2">
          <Selector etiqueta="Causa" name="retraso_causa" required defaultValue="">
            <option value="">Elige…</option>{CAUSAS_RETRASO.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </Selector>
          <Campo etiqueta="Horas del retraso" name="retraso_horas" inputMode="decimal" required ayuda="Las horas por clima no se cuentan dos veces." />
          <label className="flex flex-col gap-1.5 sm:col-span-2"><span className="text-[13px] font-medium text-leaf-800">Descripción del retraso</span><textarea name="retraso_descripcion" rows={2} maxLength={2000} required className={clase} /></label>
        </div>
      )}

      <label className="flex items-center gap-3 text-[15px]"><input type="checkbox" checked={incidente} onChange={(e) => setIncidente(e.target.checked)} className="h-5 w-5" /> Hubo un incidente</label>
      {incidente && (
        <div className="grid gap-4 rounded-card bg-leaf-50 p-4 sm:grid-cols-2">
          <Selector etiqueta="Tipo" name="incidente_tipo" required defaultValue="">
            <option value="">Elige…</option>{TIPOS_INCIDENTE.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </Selector>
          <Campo etiqueta="Persona involucrada" name="incidente_persona" required maxLength={200} />
          <label className="flex flex-col gap-1.5 sm:col-span-2"><span className="text-[13px] font-medium text-leaf-800">Descripción del incidente</span><textarea name="incidente_descripcion" rows={2} maxLength={2000} required className={clase} /></label>
        </div>
      )}

      <Area nombre="materiales" etiqueta="Materiales recibidos" />
      <Area nombre="equipos" etiqueta="Equipos y maquinaria" />
      <Area nombre="visitas" etiqueta="Visitas" />
      <Area nombre="instrucciones" etiqueta="Instrucciones o cambios solicitados" />
      <Area nombre="observaciones" etiqueta="Observaciones" />

      {error && <Aviso>{error}</Aviso>}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={ocupado} className={`${claseBoton.primario} !h-12 min-w-[180px] !text-base`}>
          {estado === "preparando" ? "Preparando fotos…" : estado === "subiendo" ? "Subiendo fotos…" : estado === "guardando" ? "Guardando…" : "Guardar bitácora"}
        </button>
        <Link href={`/proyectos/${proyectoId}/bitacora`} className={`${claseBoton.contorno} !h-12`}>Cancelar</Link>
      </div>
      <p className="text-xs text-muted">Una entrada guardada no se edita ni se borra: es el registro de la obra. Si te equivocas, deja un comentario o avisa al gerente.</p>
    </form>
  );
}
