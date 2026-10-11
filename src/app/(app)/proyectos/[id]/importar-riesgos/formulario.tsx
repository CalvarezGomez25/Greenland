"use client";

import { startTransition, useActionState, useState } from "react";
import { Aviso, claseBoton } from "@/components/ui";
import { nivelDeScore } from "@/lib/riesgos/importar";
import type { EstadoRiesgos } from "./acciones";

const MAX_ERRORES_VISIBLES = 50;
const NIVELES = ["Crítico", "Alto", "Medio", "Bajo"] as const;

export function ImportarRiesgos({ accion }: { accion: (anterior: EstadoRiesgos, datos: FormData) => Promise<EstadoRiesgos> }) {
  const [estado, enviar, pendiente] = useActionState(accion, {} as EstadoRiesgos);
  const [archivo, setArchivo] = useState<File | null>(null);

  function alElegir(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setArchivo(f);
    if (!f) return;
    const datos = new FormData();
    datos.set("archivo", f);
    datos.set("intencion", "vista");
    startTransition(() => enviar(datos));
  }

  function confirmar() {
    if (!archivo) return;
    const datos = new FormData();
    datos.set("archivo", archivo);
    datos.set("intencion", "confirmar");
    startTransition(() => enviar(datos));
  }

  const vista = estado.vista;
  const listo = !!vista && vista.errores.length === 0 && vista.riesgos.length > 0;
  const porNivel = new Map<string, number>();
  const porFrente = new Map<string, number>();
  for (const r of vista?.riesgos ?? []) {
    const n = nivelDeScore(r.probabilidad * r.impacto);
    porNivel.set(n, (porNivel.get(n) ?? 0) + 1);
    const fr = r.frente ?? "(sin frente)";
    porFrente.set(fr, (porFrente.get(fr) ?? 0) + 1);
  }

  return (
    <div className="flex flex-col gap-6">
      <label className="flex max-w-xl flex-col gap-1.5">
        <span className="text-[13px] font-medium text-leaf-800">Archivo de Excel (.xlsx)</span>
        <input
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={alElegir}
          className="block w-full rounded-[10px] border border-soil-border bg-white p-2 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-leaf-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-leaf-700"
        />
      </label>

      {pendiente && <p className="text-sm text-muted">Leyendo el archivo…</p>}
      {estado.error && <Aviso>{estado.error}</Aviso>}

      {vista && (
        <section aria-live="polite" className="flex flex-col gap-4">
          <h2 className="font-display text-xl font-bold text-leaf-700">Vista previa de «{vista.nombre}»</h2>

          {vista.errores.length > 0 && (
            <div className="rounded-card border border-danger/40 bg-red-50 p-4">
              <p className="font-medium text-danger">
                {vista.errores.length === 1 ? "Hay 1 problema" : `Hay ${vista.errores.length} problemas`} en el archivo. No se puede importar hasta corregirlos.
              </p>
              <p className="mt-1 text-sm text-muted">Se leyeron {vista.filasLeidas} filas: {vista.riesgos.length} correctas.</p>
              <ul className="mt-3 flex flex-col gap-1 text-sm">
                {vista.errores.slice(0, MAX_ERRORES_VISIBLES).map((er, i) => (
                  <li key={i}><span className="font-medium">{er.fila === null ? "Archivo" : `Fila ${er.fila}`}:</span> {er.mensaje}</li>
                ))}
              </ul>
              {vista.errores.length > MAX_ERRORES_VISIBLES && <p className="mt-2 text-sm text-muted">… y {vista.errores.length - MAX_ERRORES_VISIBLES} más.</p>}
            </div>
          )}

          {vista.avisos.map((a) => <Aviso key={a} tipo="ok">{a}</Aviso>)}

          {listo && (
            <>
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-card bg-leaf-100 p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-leaf-800">Riesgos</p>
                  <p className="mt-1 font-display text-2xl font-bold text-leaf-900">{vista.riesgos.length}</p>
                </div>
                {NIVELES.map((n) => (
                  <div key={n} className="rounded-card bg-leaf-100 p-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-leaf-800">{n}</p>
                    <p className="mt-1 font-display text-2xl font-bold text-leaf-900">{porNivel.get(n) ?? 0}</p>
                  </div>
                ))}
              </div>

              <div className="overflow-x-auto rounded-card border border-soil-border">
                <table className="w-full min-w-[420px] text-sm">
                  <thead className="bg-leaf-100 text-left text-leaf-800">
                    <tr><th scope="col" className="px-3 py-2">Frente</th><th scope="col" className="px-3 py-2 text-right">Riesgos</th></tr>
                  </thead>
                  <tbody>
                    {[...porFrente.entries()].map(([f, n]) => (
                      <tr key={f} className="border-t border-soil-border"><td className="px-3 py-2">{f}</td><td className="px-3 py-2 text-right tabular-nums">{n}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="max-w-xl rounded-card border border-soil-border bg-white p-4">
                <p className="font-medium text-leaf-800">
                  Se crearán {vista.riesgos.length - vista.existentes.length} riesgos
                  {vista.existentes.length > 0 ? ` y se actualizarán ${vista.existentes.length} que ya existen (${vista.existentes.slice(0, 5).join(", ")}${vista.existentes.length > 5 ? "…" : ""})` : ""}.
                </p>
                <p className="mt-1 text-sm text-muted">La operación es de todo o nada y cada riesgo queda en el registro de cambios.</p>
                <div className="mt-4">
                  <button type="button" onClick={confirmar} disabled={pendiente} className={claseBoton.primario}>
                    {pendiente ? "Importando…" : "Importar riesgos"}
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
