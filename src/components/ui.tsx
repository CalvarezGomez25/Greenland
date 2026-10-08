import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

// Estilos compartidos con el sistema de diseño GreenLand.
// Nota de accesibilidad: el botón principal usa leaf-600 (contraste 5,8:1 con
// texto blanco) en lugar de leaf-500 (4,3:1), que no alcanza el mínimo AA.
const base =
  "inline-flex h-10 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium tracking-wide transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-45";

export const claseBoton = {
  primario: `${base} bg-leaf-600 text-white hover:bg-leaf-700`,
  secundario: `${base} bg-leaf-100 text-leaf-900 hover:bg-leaf-200`,
  contorno: `${base} border-[1.5px] border-leaf-600 text-leaf-600 hover:bg-leaf-50`,
  peligro: `${base} border-[1.5px] border-danger text-danger hover:bg-red-50`,
};

const claseCampo =
  "h-[42px] w-full rounded-[10px] border border-soil-border bg-white px-3.5 text-[15px] font-light text-leaf-900 focus:border-leaf-500 focus:outline-none focus:ring-[3px] focus:ring-leaf-500/30";

type PropsCampo = { etiqueta: string; ayuda?: string; className?: string };

export function Campo({
  etiqueta,
  ayuda,
  className = "",
  ...resto
}: PropsCampo & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-[13px] font-medium text-leaf-800">{etiqueta}</span>
      <input {...resto} className={claseCampo} />
      {ayuda && <span className="text-xs text-muted">{ayuda}</span>}
    </label>
  );
}

export function Selector({
  etiqueta,
  ayuda,
  className = "",
  children,
  ...resto
}: PropsCampo & SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-[13px] font-medium text-leaf-800">{etiqueta}</span>
      <select {...resto} className={claseCampo}>
        {children}
      </select>
      {ayuda && <span className="text-xs text-muted">{ayuda}</span>}
    </label>
  );
}

// Título de sección: verde con subrayado café del ancho de la palabra.
export function Titulo({ children }: { children: ReactNode }) {
  return (
    <h1 className="font-display text-3xl font-bold leading-tight text-leaf-500">
      <span className="inline-block border-b-2 border-earth-600 pb-1">
        {children}
      </span>
    </h1>
  );
}

export function Aviso({
  tipo = "error",
  children,
}: {
  tipo?: "error" | "ok";
  children: ReactNode;
}) {
  const estilo =
    tipo === "error"
      ? "border-danger/40 bg-red-50 text-danger"
      : "border-leaf-300 bg-leaf-50 text-leaf-800";
  return (
    <p role={tipo === "error" ? "alert" : "status"} className={`rounded-[10px] border px-3.5 py-2.5 text-sm ${estilo}`}>
      {children}
    </p>
  );
}
