import { ETIQUETA_COLOR, type Color } from "@/lib/pmo/semaforo";

const ESTILO: Record<Color, string> = {
  verde: "bg-leaf-100 text-leaf-800 border-leaf-400",
  amarillo: "bg-amber-100 text-amber-900 border-amber-500",
  rojo: "bg-red-100 text-red-900 border-red-500",
};
const PUNTO: Record<Color, string> = { verde: "bg-leaf-500", amarillo: "bg-amber-500", rojo: "bg-red-600" };

// El color siempre va acompañado de la palabra: no depende solo del color para entenderse.
export function Semaforo({ color }: { color: Color | null }) {
  if (color === null) {
    return <span className="inline-flex items-center gap-1.5 rounded-full border border-soil-border bg-white px-2.5 py-0.5 text-xs text-muted">Sin datos</span>;
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${ESTILO[color]}`}>
      <span aria-hidden className={`h-2 w-2 rounded-full ${PUNTO[color]}`} />
      {ETIQUETA_COLOR[color]}
    </span>
  );
}
