import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { Ayuda } from "./ayuda";
import type { TemaAyuda } from "@/lib/glosario";

// Estilos compartidos con el sistema de diseño GreenLand v1.0.0: píldoras (radio completo), contorno de 1,5 px en el verde
// de trabajo #027001, sin sombras; el hover baja la opacidad a 0,85 (regla global en globals.css).
const base =
  "inline-flex h-10 items-center justify-center gap-2 rounded-full px-[26px] text-[15px] font-normal disabled:cursor-not-allowed disabled:opacity-45";

export const claseBoton = {
  primario: `${base} border-[1.5px] border-leaf-600 bg-leaf-600 text-white`,
  secundario: `${base} border-[1.5px] border-leaf-600 bg-white text-leaf-600`,
  contorno: `${base} border-[1.5px] border-leaf-600 bg-white text-leaf-600`,
  peligro: `${base} border-[1.5px] border-alerta-crit bg-white text-alerta-crit`,
};

export const claseCampo =
  "h-[42px] w-full rounded-full border-[1.5px] border-soil-border bg-white px-[22px] text-[15px] font-normal text-leaf-900 focus:border-leaf-500 focus:outline-none";

type PropsCampo = { etiqueta: string; ayuda?: string; className?: string; tema?: TemaAyuda };

// Rótulo del campo con su ayuda emergente (si tiene tema).
function Rotulo({ id, etiqueta, tema }: { id: string; etiqueta: string; tema?: TemaAyuda }) {
  return (
    <div className="flex items-center gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-leaf-800">{etiqueta}</label>
      {tema && <Ayuda tema={tema} />}
    </div>
  );
}

export function Campo({
  etiqueta,
  ayuda,
  tema,
  className = "",
  ...resto
}: PropsCampo & InputHTMLAttributes<HTMLInputElement>) {
  const idAuto = useId();
  const id = resto.id ?? idAuto;
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <Rotulo id={id} etiqueta={etiqueta} tema={tema} />
      {/* min-w-0 y sin apariencia nativa: en el iPhone los campos de fecha se salían de la tarjeta */}
      <input {...resto} id={id} className={`${claseCampo} min-w-0 max-w-full [&[type=date]]:appearance-none [&[type=month]]:appearance-none`} />
      {ayuda && <span className="text-xs text-muted">{ayuda}</span>}
    </div>
  );
}

export function Selector({
  etiqueta,
  ayuda,
  tema,
  className = "",
  children,
  ...resto
}: PropsCampo & SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  const idAuto = useId();
  const id = resto.id ?? idAuto;
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <Rotulo id={id} etiqueta={etiqueta} tema={tema} />
      <select {...resto} id={id} className={claseCampo}>
        {children}
      </select>
      {ayuda && <span className="text-xs text-muted">{ayuda}</span>}
    </div>
  );
}

// Título de sección: verde de trabajo, Light, sin subrayado.
export function Titulo({ children }: { children: ReactNode }) {
  return <h1 className="font-display text-[34px] font-light leading-[1.05] text-leaf-500">{children}</h1>;
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
      ? "border-alerta-crit text-alerta-crit"
      : "border-leaf-500 text-leaf-500";
  return (
    <p role={tipo === "error" ? "alert" : "status"} className={`rounded-[20px] border-[1.5px] bg-white px-[22px] py-2.5 text-sm ${estilo}`}>
      {children}
    </p>
  );
}
