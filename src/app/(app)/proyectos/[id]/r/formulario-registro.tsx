"use client";

import { useActionState, useRef } from "react";
import { BotonEnviar } from "@/components/boton-enviar";
import { Aviso, Campo, Selector, claseBoton } from "@/components/ui";
import type { Estado } from "@/lib/presupuesto/estado";
import type { CampoDef, Opcion, Sugerencia } from "@/lib/registros/tipos";
import Link from "next/link";

export function FormularioRegistro({
  accion,
  campos,
  opciones,
  iniciales,
  editando,
  volverA,
  sugerencias,
}: {
  accion: (anterior: Estado, datos: FormData) => Promise<Estado>;
  campos: CampoDef[];
  opciones: Record<string, Opcion[]>;
  iniciales: Record<string, string>;
  editando: boolean;
  volverA: string;
  sugerencias?: { etiqueta: string; ayuda?: string; lista: Sugerencia[] };
}) {
  const [estado, enviar] = useActionState(accion, {} as Estado);
  const formulario = useRef<HTMLFormElement>(null);
  // Al elegir una sugerencia se copian sus valores a los campos del formulario (que siguen siendo editables).
  const aplicar = (valor: string) => {
    const s = sugerencias?.lista.find((x) => x.valor === valor);
    if (!s || !formulario.current) return;
    for (const [nombre, texto] of Object.entries(s.valores)) {
      const campo = formulario.current.elements.namedItem(nombre);
      if (campo instanceof HTMLInputElement || campo instanceof HTMLTextAreaElement) campo.value = texto;
    }
  };
  const v = (c: CampoDef) => estado.valores?.[c.nombre] ?? iniciales[c.nombre] ?? c.porDefecto ?? "";

  return (
    <form
      ref={formulario}
      action={enviar}
      key={estado.valores ? JSON.stringify(estado.valores) : "inicial"}
      className="flex max-w-2xl flex-col gap-4"
    >
      {!editando && sugerencias && sugerencias.lista.length > 0 && (
        <Selector etiqueta={sugerencias.etiqueta} ayuda={sugerencias.ayuda} defaultValue="" onChange={(e) => aplicar(e.target.value)}>
          <option value="">— Escribir uno nuevo —</option>
          {sugerencias.lista.map((o) => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
        </Selector>
      )}
      {campos.map((c) => {
        if (c.soloAlCrear && editando) return null;
        const comun = { etiqueta: c.etiqueta + (c.obligatorio ? "" : " (opcional)"), name: c.nombre, ayuda: c.ayuda };
        if (c.tipo === "area") {
          return (
            <label key={c.nombre} className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-leaf-800">{comun.etiqueta}</span>
              <textarea
                name={c.nombre}
                rows={4}
                maxLength={c.max ?? 4000}
                required={c.obligatorio}
                defaultValue={v(c)}
                className="w-full rounded-[20px] border border-soil-border bg-white px-3.5 py-2.5 text-[15px] font-light text-leaf-900 focus:border-leaf-500 focus:outline-none focus:ring-[3px] focus:ring-leaf-500/30"
              />
              {c.ayuda && <span className="text-xs text-muted">{c.ayuda}</span>}
            </label>
          );
        }
        if (c.tipo === "seleccion") {
          const ops = c.opciones ?? (c.opcionesDe ? opciones[c.opcionesDe] : undefined) ?? [];
          return (
            <Selector key={c.nombre} {...comun} required={c.obligatorio} defaultValue={v(c)}>
              {!c.obligatorio && <option value="">— Sin elegir —</option>}
              {c.obligatorio && v(c) === "" && <option value="">Elige…</option>}
              {ops.map((o) => (
                <option key={o.valor} value={o.valor}>{o.etiqueta}</option>
              ))}
            </Selector>
          );
        }
        if (c.tipo === "casilla") {
          return (
            <label key={c.nombre} className="flex items-center gap-2 text-sm text-leaf-900">
              <input type="checkbox" name={c.nombre} defaultChecked={v(c) === "on" || v(c) === "true"} className="h-4 w-4" />
              {c.etiqueta}
            </label>
          );
        }
        return (
          <Campo
            key={c.nombre}
            {...comun}
            required={c.obligatorio}
            defaultValue={v(c)}
            type={c.tipo === "fecha" ? "date" : "text"}
            inputMode={c.tipo === "entero" ? "numeric" : c.tipo === "decimal" ? "decimal" : undefined}
            maxLength={c.tipo === "texto" ? (c.max ?? 200) : undefined}
          />
        );
      })}
      {estado.error && <Aviso>{estado.error}</Aviso>}
      <div className="flex gap-3">
        <BotonEnviar className={claseBoton.primario} textoEnviando="Guardando…">Guardar</BotonEnviar>
        <Link href={volverA} className={claseBoton.contorno}>Cancelar</Link>
      </div>
    </form>
  );
}
