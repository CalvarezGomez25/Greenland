"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { GLOSARIO, type TemaAyuda } from "@/lib/glosario";

// Ayuda emergente con un ícono «?». Se abre al pasar el ratón, al enfocar con el teclado o al tocar el ícono
// (en el celular); se cierra con Escape, al tocar fuera o al desplazarse.
//  - modo "icono": solo el ícono, junto a un rótulo o título.
//  - modo "tarjeta": envuelve una tarjeta; al pasar el ratón por cualquier parte de la tarjeta se muestra la ayuda.
type Props = { tema?: TemaAyuda; modo?: "icono" | "tarjeta"; className?: string; children?: ReactNode };
type Posicion = { top: number; left: number; ancho: number };

const ANCHO = 288;

export function Ayuda({ tema, modo = "icono", className = "", children }: Props) {
  const info = tema ? GLOSARIO[tema] : undefined;
  const id = useId();
  const raiz = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Posicion | null>(null);
  const [fija, setFija] = useState(false); // abierta por clic o teclado
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);

  const medir = () => {
    const r = raiz.current?.getBoundingClientRect();
    if (!r) return;
    const ancho = Math.min(ANCHO, window.innerWidth - 16);
    const izquierda = Math.max(8, Math.min(r.left, window.innerWidth - ancho - 8));
    // Debajo del elemento; si no cabe, arriba.
    const abajo = r.bottom + 8;
    const top = abajo + 170 > window.innerHeight && r.top > 190 ? Math.max(8, r.top - 8 - 170) : abajo;
    setPos({ top, left: izquierda, ancho });
  };
  const abrir = () => { if (espera.current) clearTimeout(espera.current); medir(); };
  const cerrar = () => { if (espera.current) clearTimeout(espera.current); espera.current = null; setPos(null); setFija(false); };
  const sobre = () => {
    if (espera.current) clearTimeout(espera.current);
    espera.current = setTimeout(abrir, modo === "tarjeta" ? 350 : 120); // evita parpadeos al cruzar tarjetas
  };

  const visible = pos !== null;
  useEffect(() => {
    if (!visible) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") cerrar(); };
    const fuera = (e: Event) => { if (fija && raiz.current && !raiz.current.contains(e.target as Node)) cerrar(); };
    const mover = () => cerrar();
    window.addEventListener("keydown", tecla);
    document.addEventListener("pointerdown", fuera);
    window.addEventListener("scroll", mover, true);
    window.addEventListener("resize", mover);
    return () => {
      window.removeEventListener("keydown", tecla);
      document.removeEventListener("pointerdown", fuera);
      window.removeEventListener("scroll", mover, true);
      window.removeEventListener("resize", mover);
    };
  }, [visible, fija]);

  if (!info) return modo === "tarjeta" ? <div className={className}>{children}</div> : null;

  const icono = (
    <button
      type="button"
      aria-label={`Ayuda: ${info.titulo}`}
      aria-expanded={visible}
      aria-describedby={visible ? id : undefined}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (visible && fija) cerrar(); else { setFija(true); abrir(); } }}
      onFocus={() => { setFija(true); abrir(); }}
      onBlur={() => { if (fija) cerrar(); }}
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-leaf-600/60 bg-white align-middle text-[10px] font-bold leading-none text-leaf-700 hover:bg-leaf-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-leaf-600"
    >
      ?
    </button>
  );

  const ventana = pos && (
    <span
      id={id}
      role="tooltip"
      style={{ top: pos.top, left: pos.left, width: pos.ancho }}
      className="pointer-events-none fixed z-[70] block rounded-[20px] border border-soil-border bg-white p-3 text-left text-xs font-normal normal-case leading-snug tracking-normal text-leaf-900 "
    >
      <strong className="block text-[13px] font-semibold text-leaf-700">{info.titulo}</strong>
      <span className="mt-1 block">{info.texto}</span>
      {"ejemplo" in info && <span className="mt-1.5 block rounded-[20px] border-[1.5px] border-soil-border px-2 py-1 text-leaf-800"><b>Ejemplo:</b> {info.ejemplo}</span>}
      {"meta" in info && <span className="mt-1.5 block text-muted">{info.meta}</span>}
    </span>
  );

  if (modo === "tarjeta") {
    return (
      <div ref={raiz} className={`relative ${className}`} onMouseEnter={sobre} onMouseLeave={() => { if (!fija) cerrar(); }}>
        {children}
        <span className="absolute right-2 top-2">{icono}</span>
        {ventana}
      </div>
    );
  }
  return (
    <span ref={raiz as unknown as React.RefObject<HTMLSpanElement>} className={`relative inline-flex items-center ${className}`} onMouseEnter={sobre} onMouseLeave={() => { if (!fija) cerrar(); }}>
      {icono}
      {ventana}
    </span>
  );
}
