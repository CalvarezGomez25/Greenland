import Link from "next/link";
import { Ayuda } from "@/components/ayuda";
import { porcentaje } from "@/lib/pmo/formato";

// Avance del proyecto: lo planeado frente a lo construido. Aro exterior = avance físico (lo construido); marca = avance
// planificado (lo que debería llevar según el plan); aro interior = avance financiero (lo gastado). Es SVG puro,
// sin gráficos externos, y el valor siempre se escribe también en texto (no depende solo del color).
type Props = { fisico: number | null; financiero: number | null; planificado: number | null; href: string };

const R = 80;
const R_FIN = 60;
const C = (r: number) => 2 * Math.PI * r;
const tope = (n: number | null) => (n === null ? 0 : Math.max(0, Math.min(100, n)));
// Serie oficial del sistema de diseño: #027001, #84B71E y gris #5E5E5E; pista en gris #E4E4E4.
const COLOR = { fisico: "#027001", financiero: "#84b71e", plan: "#5e5e5e" };

export function GraficoAvance({ fisico, financiero, planificado, href }: Props) {
  const hay = fisico !== null;
  const marca = planificado === null ? null : (tope(planificado) / 100) * 2 * Math.PI - Math.PI / 2;
  const frente = fisico !== null && planificado !== null ? Math.round((fisico - planificado) * 10) / 10 : null;
  const descripcion = hay
    ? `Avance físico ${porcentaje(fisico)}, financiero ${porcentaje(financiero)}, planificado ${porcentaje(planificado)}`
    : "Sin mediciones de valor ganado";

  return (
    <Link href={href} className="block h-full rounded-card border-[1.5px] border-leaf-500 bg-white p-5" aria-label={`Avance del proyecto. ${descripcion}. Abrir valor ganado`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-bold text-leaf-700">Avance del proyecto</h2>
          <p className="text-sm text-muted">Lo planeado frente a lo construido</p>
        </div>
        <Ayuda tema="avance_fisico" />
      </div>

      <div className="relative mx-auto mt-3 w-full max-w-[220px]">
        <svg viewBox="0 0 200 200" role="img" aria-label={descripcion} className="block w-full">
          <g transform="rotate(-90 100 100)" fill="none" strokeLinecap="round">
            <circle cx="100" cy="100" r={R} stroke="#e4e4e4" strokeWidth="14" />
            {hay && tope(fisico) > 0 && <circle cx="100" cy="100" r={R} stroke={COLOR.fisico} strokeWidth="14" strokeDasharray={`${(C(R) * tope(fisico)) / 100} ${C(R)}`} />}
            <circle cx="100" cy="100" r={R_FIN} stroke="#f2f2f2" strokeWidth="6" />
            {financiero !== null && tope(financiero) > 0 && <circle cx="100" cy="100" r={R_FIN} stroke={COLOR.financiero} strokeWidth="6" strokeDasharray={`${(C(R_FIN) * tope(financiero)) / 100} ${C(R_FIN)}`} />}
          </g>
          {marca !== null && (
            <line x1={100 + (R - 13) * Math.cos(marca)} y1={100 + (R - 13) * Math.sin(marca)} x2={100 + (R + 13) * Math.cos(marca)} y2={100 + (R + 13) * Math.sin(marca)} stroke={COLOR.plan} strokeWidth="3.5" strokeLinecap="round" />
          )}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-3xl font-bold leading-none text-leaf-900">{hay ? porcentaje(fisico) : "—"}</span>
          <span className="mt-1 text-xs text-muted">Avance físico</span>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-soil-border pt-3 text-center">
        {([["Físico", fisico, COLOR.fisico], ["Financiero", financiero, COLOR.financiero], ["Planificado", planificado, COLOR.plan]] as const).map(([etiqueta, valor, color]) => (
          <div key={etiqueta}>
            <dt className="flex items-center justify-center gap-1.5 text-xs text-muted">
              <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
              {etiqueta}
            </dt>
            <dd className="mt-0.5 font-display text-base font-bold text-leaf-900">{porcentaje(valor)}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-center text-xs text-muted">
        {hay
          ? frente === null
            ? "Sin plan para comparar."
            : frente === 0
              ? "Va al ritmo del plan."
              : `${Math.abs(frente).toLocaleString("es-CO", { maximumFractionDigits: 1 })} puntos ${frente < 0 ? "por debajo" : "por encima"} del plan.`
          : "Aún no hay mediciones de valor ganado."}
      </p>
    </Link>
  );
}
