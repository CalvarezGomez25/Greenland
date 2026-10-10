"use client";

import { startTransition, useActionState, useState } from "react";
import { Aviso, Campo, claseBoton } from "@/components/ui";
import { calcularPresupuesto, presupuestoDesdeImportacion } from "@/lib/presupuesto/calculos";
import { leerCsvPresupuesto, MAX_CARACTERES_IMPORTACION, type ResultadoCsv } from "@/lib/presupuesto/csv";
import { formatearPesos } from "@/lib/presupuesto/dinero";
import type { Estado } from "@/lib/presupuesto/estado";

const MAX_ERRORES_VISIBLES = 50;

// Lee los bytes como UTF-8; si no lo son (Excel suele guardar en Windows-1252), usa Windows-1252.
function decodificar(bytes: ArrayBuffer): { texto: string; aviso: string | null } {
  try {
    return { texto: new TextDecoder("utf-8", { fatal: true }).decode(bytes), aviso: null };
  } catch {
    return {
      texto: new TextDecoder("windows-1252").decode(bytes),
      aviso: "El archivo no estaba en UTF-8; se leyó como Windows-1252 (el formato habitual de Excel). Revisa que las tildes se vean bien.",
    };
  }
}

export function ImportarCsv({
  accion,
  actuales,
}: {
  accion: (anterior: Estado, datos: FormData) => Promise<Estado>;
  actuales: { partidas: number; costoDirecto: string };
}) {
  const [estado, enviar, pendiente] = useActionState(accion, {} as Estado);
  const [archivo, setArchivo] = useState<{ nombre: string; texto: string; aviso: string | null; lectura: ResultadoCsv } | null>(null);
  const [problema, setProblema] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");

  async function alElegir(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setArchivo(null);
    setProblema(null);
    if (!f) return;
    if (f.size > MAX_CARACTERES_IMPORTACION) {
      setProblema("El archivo supera el tamaño máximo de 2 MB.");
      return;
    }
    const { texto, aviso } = decodificar(await f.arrayBuffer());
    setArchivo({ nombre: f.name, texto, aviso, lectura: leerCsvPresupuesto(texto) });
  }

  function confirmar() {
    if (!archivo) return;
    const datos = new FormData();
    datos.set("texto", archivo.texto);
    datos.set("motivo", motivo);
    startTransition(() => enviar(datos));
  }

  const lectura = archivo?.lectura;
  const sinErrores = !!lectura && lectura.errores.length === 0 && lectura.filas.length > 0;
  const resumen = sinErrores
    ? (() => {
        const p = calcularPresupuesto({ ...presupuestoDesdeImportacion(lectura.filas), lineas: [] });
        return p;
      })()
    : null;

  return (
    <div className="flex flex-col gap-6">
      <label className="flex max-w-xl flex-col gap-1.5">
        <span className="text-[13px] font-medium text-leaf-800">Archivo CSV</span>
        <input
          type="file"
          accept=".csv,.txt,.tsv,text/csv,text/plain"
          onChange={alElegir}
          className="block w-full rounded-[10px] border border-soil-border bg-white p-2 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-leaf-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-leaf-700"
        />
      </label>

      {problema && <Aviso>{problema}</Aviso>}
      {archivo?.aviso && <Aviso tipo="ok">{archivo.aviso}</Aviso>}

      {lectura && (
        <section aria-live="polite" className="flex flex-col gap-4">
          <h2 className="font-display text-xl font-bold text-leaf-700">Vista previa de «{archivo.nombre}»</h2>

          {lectura.errores.length > 0 && (
            <div className="rounded-card border border-danger/40 bg-red-50 p-4">
              <p className="font-medium text-danger">
                {lectura.errores.length === 1 ? "Hay 1 problema" : `Hay ${lectura.errores.length} problemas`} en el archivo.
                No se puede importar hasta corregirlos.
              </p>
              <p className="mt-1 text-sm text-muted">
                Se leyeron {lectura.filasLeidas} filas: {lectura.filas.length} correctas.
              </p>
              <ul className="mt-3 flex flex-col gap-1 text-sm">
                {lectura.errores.slice(0, MAX_ERRORES_VISIBLES).map((er, i) => (
                  <li key={i}>
                    <span className="font-medium">{er.fila === null ? "Archivo" : `Fila ${er.fila}`}:</span> {er.mensaje}
                  </li>
                ))}
              </ul>
              {lectura.errores.length > MAX_ERRORES_VISIBLES && (
                <p className="mt-2 text-sm text-muted">… y {lectura.errores.length - MAX_ERRORES_VISIBLES} más.</p>
              )}
            </div>
          )}

          {resumen && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-card bg-leaf-100 p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-leaf-800">Partidas</p>
                  <p className="mt-1 font-display text-xl font-bold [overflow-wrap:anywhere] sm:text-2xl text-leaf-900">{lectura.filas.length}</p>
                </div>
                <div className="rounded-card bg-leaf-100 p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-leaf-800">Capítulos</p>
                  <p className="mt-1 font-display text-xl font-bold [overflow-wrap:anywhere] sm:text-2xl text-leaf-900">{resumen.capitulos.length}</p>
                </div>
                <div className="rounded-card bg-leaf-100 p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-leaf-800">Costo directo</p>
                  <p className="mt-1 font-display text-xl font-bold [overflow-wrap:anywhere] sm:text-2xl tabular-nums text-leaf-900">$ {formatearPesos(resumen.costoDirecto)}</p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-card border border-soil-border">
                <table className="w-full min-w-[420px] text-sm">
                  <thead className="bg-leaf-100 text-left text-leaf-800">
                    <tr>
                      <th scope="col" className="px-3 py-2">Capítulo</th>
                      <th scope="col" className="px-3 py-2 text-right">Partidas</th>
                      <th scope="col" className="px-3 py-2 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumen.capitulos.map((c) => (
                      <tr key={c.id} className="border-t border-soil-border">
                        <td className="px-3 py-2">{c.codigo}. {c.nombre}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{c.partidas.length}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatearPesos(c.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="max-w-xl rounded-card border border-earth-600/40 bg-white p-4">
                <p className="font-medium text-earth-600">Esto reemplaza todo el presupuesto actual</p>
                <p className="mt-1 text-sm text-muted">
                  Hoy el proyecto tiene {actuales.partidas} partidas con costo directo de $ {actuales.costoDirecto}. Las partidas
                  actuales se borran y se sustituyen por las del archivo. Los costos adicionales y el gasto real no se tocan.
                  La operación es de todo o nada y queda en el registro de cambios.
                </p>
                <div className="mt-3">
                  <Campo
                    etiqueta="Motivo de la importación (obligatorio)"
                    name="motivo-vista"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    maxLength={500}
                    placeholder="Por ejemplo: carga inicial del presupuesto"
                  />
                </div>
                {estado.error && (
                  <div className="mt-3">
                    <Aviso>{estado.error}</Aviso>
                  </div>
                )}
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={confirmar}
                    disabled={pendiente || motivo.trim().length < 3}
                    className={claseBoton.primario}
                  >
                    {pendiente ? "Importando…" : "Reemplazar el presupuesto"}
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
