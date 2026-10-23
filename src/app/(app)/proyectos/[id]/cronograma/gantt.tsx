"use client";

import { useRef, useState, useTransition } from "react";

export type BarraGantt = { id: string; nombre: string; inicio: number; duracion: number; avance: number };

const ANCHO_SEMANA = 28;
const ALTO_FILA = 34;
const COLUMNA_NOMBRES = 170;

type Arrastre = { id: string; modo: "mover" | "redimensionar"; x0: number; inicio0: number; duracion0: number };

// Gantt en semanas. Con `editable`, las barras se mueven y se redimensionan arrastrando
// (ratón o dedo): al soltar se guarda. Siempre se puede editar también desde la tabla.
export function Gantt({
  barras, semanas, semanaActual, editable, guardar,
}: {
  barras: BarraGantt[];
  semanas: number;
  semanaActual: number | null;
  editable: boolean;
  guardar: (id: string, inicio: number, duracion: number) => Promise<{ error?: string }>;
}) {
  const [local, setLocal] = useState<Record<string, { inicio: number; duracion: number }>>({});
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  const arrastre = useRef<Arrastre | null>(null);

  const valor = (b: BarraGantt) => local[b.id] ?? { inicio: b.inicio, duracion: b.duracion };
  const totalSemanas = Math.max(semanas, ...barras.map((b) => valor(b).inicio + valor(b).duracion - 1), semanaActual ?? 0) + 2;

  function abajo(e: React.PointerEvent<HTMLDivElement>, b: BarraGantt) {
    if (!editable || pendiente) return;
    const caja = e.currentTarget.getBoundingClientRect();
    const modo = e.clientX > caja.right - 12 ? "redimensionar" : "mover";
    e.currentTarget.setPointerCapture(e.pointerId);
    arrastre.current = { id: b.id, modo, x0: e.clientX, inicio0: valor(b).inicio, duracion0: valor(b).duracion };
    setError(null);
  }
  function mueve(e: React.PointerEvent<HTMLDivElement>) {
    const a = arrastre.current;
    if (!a) return;
    const d = Math.round((e.clientX - a.x0) / ANCHO_SEMANA);
    setLocal((l) => ({
      ...l,
      [a.id]: a.modo === "mover" ? { inicio: Math.max(1, a.inicio0 + d), duracion: a.duracion0 } : { inicio: a.inicio0, duracion: Math.max(1, a.duracion0 + d) },
    }));
  }
  function suelta(b: BarraGantt) {
    const a = arrastre.current;
    arrastre.current = null;
    if (!a) return;
    const v = valor(b);
    if (v.inicio === b.inicio && v.duracion === b.duracion) return;
    empezar(async () => {
      const r = await guardar(b.id, v.inicio, v.duracion);
      if (r.error) {
        setError(r.error);
        setLocal((l) => { const n = { ...l }; delete n[b.id]; return n; });
      }
    });
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-card border border-soil-border" role="group" aria-label="Diagrama de Gantt en semanas">
        <div style={{ width: COLUMNA_NOMBRES + totalSemanas * ANCHO_SEMANA }} className="relative">
          <div className="flex border-b border-soil-border bg-leaf-100 text-[11px] text-leaf-800" style={{ height: 26 }}>
            <div className="shrink-0 px-2 py-1 font-medium" style={{ width: COLUMNA_NOMBRES }}>Tarea</div>
            {Array.from({ length: totalSemanas }, (_, i) => (
              <div key={i} className={`shrink-0 border-l border-soil-border py-1 text-center ${semanaActual === i + 1 ? "bg-leaf-300 font-bold" : ""}`} style={{ width: ANCHO_SEMANA }}>{i + 1}</div>
            ))}
          </div>
          {barras.map((b) => {
            const v = valor(b);
            return (
              <div key={b.id} className="relative flex border-b border-soil-border/60" style={{ height: ALTO_FILA }}>
                <div className="shrink-0 truncate px-2 text-sm leading-[34px]" style={{ width: COLUMNA_NOMBRES }} title={b.nombre}>{b.nombre}</div>
                <div className="relative" style={{ width: totalSemanas * ANCHO_SEMANA }}>
                  {semanaActual !== null && <div className="absolute inset-y-0 w-px bg-leaf-600/60" style={{ left: (semanaActual - 1) * ANCHO_SEMANA + ANCHO_SEMANA / 2 }} aria-hidden />}
                  <div
                    role="img"
                    aria-label={`${b.nombre}: semana ${v.inicio}, ${v.duracion} semana(s), avance ${b.avance} %`}
                    onPointerDown={(e) => abajo(e, b)}
                    onPointerMove={mueve}
                    onPointerUp={() => suelta(b)}
                    onPointerCancel={() => suelta(b)}
                    className={`absolute top-1.5 overflow-hidden rounded-md bg-leaf-200 ring-1 ring-leaf-500 ${editable ? "cursor-grab touch-none active:cursor-grabbing" : ""} ${pendiente ? "opacity-60" : ""}`}
                    style={{ left: (v.inicio - 1) * ANCHO_SEMANA, width: v.duracion * ANCHO_SEMANA - 2, height: ALTO_FILA - 12 }}
                  >
                    <div className="h-full bg-leaf-500/80" style={{ width: `${Math.min(100, b.avance)}%` }} />
                    {editable && <div className="absolute inset-y-0 right-0 w-3 cursor-ew-resize bg-leaf-700/30" aria-hidden />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-2 text-xs text-muted">
        {editable ? "Arrastra una barra para moverla; arrastra su borde derecho para cambiar la duración. " : ""}
        La parte oscura de cada barra es el avance. La línea vertical marca la semana actual.
      </p>
      {error && <p role="alert" className="mt-2 rounded-[10px] border border-danger/40 bg-red-50 px-3 py-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
