import { ETIQUETA_COLOR, type Color } from "@/lib/pmo/semaforo";

// Pill de estado del sistema de diseño GreenLand: contorno de 1,5 px y texto del mismo color (paleta de alertas 2.1).
// Verde = Cumple, Amarillo = Atención, Rojo = Crítico. El estado siempre lleva la palabra; sin círculos decorativos.
const ESTILO: Record<Color, string> = {
  verde: "border-alerta-ok text-alerta-ok",
  amarillo: "border-alerta-aten text-alerta-aten",
  rojo: "border-alerta-crit text-alerta-crit",
};

export function Semaforo({ color }: { color: Color | null }) {
  if (color === null) {
    return <span className="inline-flex items-center rounded-full border-[1.5px] border-alerta-info bg-white px-3 py-0.5 text-xs font-medium text-alerta-info">Sin datos</span>;
  }
  return (
    <span className={`inline-flex items-center rounded-full border-[1.5px] bg-white px-3 py-0.5 text-xs font-medium ${ESTILO[color]}`}>
      {ETIQUETA_COLOR[color]}
    </span>
  );
}
