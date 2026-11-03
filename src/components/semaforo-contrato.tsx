import { ETIQUETA_NIVEL, type Nivel } from "@/lib/contratos/vigilancia";

const ESTILO: Record<Nivel, string> = {
  verde: "bg-leaf-100 text-leaf-800 border-leaf-400",
  ambar: "bg-amber-100 text-amber-900 border-amber-500",
  rojo: "bg-red-100 text-red-900 border-red-500",
  archivado: "bg-white text-muted border-soil-border",
};
const PUNTO: Record<Nivel, string> = { verde: "bg-leaf-500", ambar: "bg-amber-500", rojo: "bg-red-600", archivado: "bg-soil-border" };

// El color siempre va acompañado de la palabra: no depende solo del color para entenderse.
export function SemaforoContrato({ nivel }: { nivel: Nivel }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${ESTILO[nivel]}`}>
      <span aria-hidden className={`h-2 w-2 rounded-full ${PUNTO[nivel]}`} />
      {ETIQUETA_NIVEL[nivel]}
    </span>
  );
}
