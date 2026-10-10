import type { SerieKpi } from "@/lib/pmo/kpis";

const fmt = (v: number | null, u: "%" | "puntos") => (v === null ? "—" : u === "%" ? `${v.toLocaleString("es-CO", { maximumFractionDigits: 1 })} %` : v.toLocaleString("es-CO", { maximumFractionDigits: 1 }));
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const etiquetaMes = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`;

// Tabla de los seis KPIs: valor actual, meta, tendencia y los últimos meses. La palabra acompaña al símbolo.
export function TablaKpis({ series }: { series: SerieKpi[] }) {
  return (
    <div className="overflow-x-auto rounded-card border border-soil-border">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-leaf-100 text-xs uppercase tracking-wider text-leaf-800">
          <tr>
            <th className="px-3 py-2 font-medium">KPI</th><th className="px-3 py-2 font-medium">Actual</th><th className="px-3 py-2 font-medium">Meta</th><th className="px-3 py-2 font-medium">Tendencia</th>
            {series[0]?.puntos.map((p) => <th key={p.mes} className="px-2 py-2 text-right font-medium">{etiquetaMes(p.mes)}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-soil-border">
          {series.map((s) => (
            <tr key={s.clave}>
              <td className="px-3 py-2"><p className="font-medium text-leaf-900">{s.nombre}</p><p className="text-xs text-muted">{s.fuente}</p></td>
              <td className="px-3 py-2"><span className={`font-display text-lg font-bold ${s.cumple === null ? "text-muted" : s.cumple ? "text-leaf-700" : "text-danger"}`}>{fmt(s.actual, s.unidad)}</span>{s.cumple !== null && <span className="ml-1 text-xs text-muted">{s.cumple ? "cumple" : "no cumple"}</span>}</td>
              <td className="px-3 py-2">≥ {fmt(s.meta, s.unidad)}</td>
              <td className="px-3 py-2">{s.tendencia === "sube" ? "↑ Sube" : s.tendencia === "baja" ? "↓ Baja" : s.tendencia === "igual" ? "→ Igual" : "—"}</td>
              {s.puntos.map((p) => <td key={p.mes} className="px-2 py-2 text-right text-muted" title={p.den ? `${p.num} de ${p.den}` : "Sin datos"}>{fmt(p.valor, s.unidad)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
