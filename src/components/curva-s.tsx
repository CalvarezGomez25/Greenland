import type { PuntoCurva } from "@/lib/presupuesto/curva";

// Gráfico de la Curva S en SVG puro (sin librerías). Se dibuja en millones de pesos.
// Los valores se convierten a número solo para dibujar, no para calcular dinero.
// Plan y real se distinguen por trazo (discontinuo / continuo) y por tono, no solo por color.

const ANCHO = 720;
const ALTO = 320;
const M = { izq: 70, der: 16, arr: 30, aba: 36 };
const COLOR_PLAN = "#5f86c4";
const COLOR_REAL = "#7c401d";
const COLOR_TEXTO = "#555552";
const COLOR_REJILLA = "#dcdcd8";

const aMillones = (monto: bigint) => Number(monto) / 1e12; // monto escala 6 → millones de pesos
const fmt = (n: number) => n.toLocaleString("es-CO", { maximumFractionDigits: 0 });

export function CurvaS({ puntos, mesesSinRegistro = [] }: { puntos: PuntoCurva[]; mesesSinRegistro?: number[] }) {
  const ultimoMes = puntos.length - 1;
  const maximo = Math.max(
    ...puntos.map((p) => aMillones(p.planificado)),
    ...puntos.map((p) => (p.real === null ? 0 : aMillones(p.real))),
  );
  if (!(maximo > 0)) {
    return <p className="rounded-card bg-leaf-50 p-6 text-center text-sm text-muted">Sin presupuesto para graficar.</p>;
  }

  const anchoUtil = ANCHO - M.izq - M.der;
  const altoUtil = ALTO - M.arr - M.aba;
  const x = (mes: number) => M.izq + (mes / ultimoMes) * anchoUtil;
  const y = (v: number) => M.arr + altoUtil - (v / maximo) * altoUtil;

  const camino = (valores: { mes: number; v: number }[]) =>
    valores.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.mes).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ");

  const plan = puntos.map((p) => ({ mes: p.mes, v: aMillones(p.planificado) }));
  const real = puntos.filter((p) => p.real !== null).map((p) => ({ mes: p.mes, v: aMillones(p.real as bigint) }));
  const pasoX = ultimoMes > 14 ? 2 : 1;
  const marcasY = [0, 0.25, 0.5, 0.75, 1].map((f) => f * maximo);

  return (
    <div>
      {/* En pantallas angostas el gráfico conserva un ancho mínimo y se desplaza, para que el texto sea legible */}
      <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        role="img"
        aria-label="Curva S: gasto planificado acumulado frente al gasto real acumulado, en millones de pesos por mes"
        className="h-auto w-full min-w-[640px]"
      >
        {marcasY.map((v) => (
          <g key={v}>
            <line x1={M.izq} x2={ANCHO - M.der} y1={y(v)} y2={y(v)} stroke={COLOR_REJILLA} />
            <text x={M.izq - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill={COLOR_TEXTO}>
              {fmt(v)}
            </text>
          </g>
        ))}
        {puntos
          .filter((p) => p.mes % pasoX === 0)
          .map((p) => (
            <text key={p.mes} x={x(p.mes)} y={ALTO - 14} textAnchor="middle" fontSize="11" fill={COLOR_TEXTO}>
              {p.mes}
            </text>
          ))}
        <text x={M.izq} y={13} fontSize="11" fill={COLOR_TEXTO}>
          Millones de pesos (acumulado) · eje horizontal: mes
        </text>

        <path d={camino(plan)} fill="none" stroke={COLOR_PLAN} strokeWidth="2.5" strokeDasharray="7 4" />
        {real.length > 1 && <path d={camino(real)} fill="none" stroke={COLOR_REAL} strokeWidth="2.5" />}
        {real.slice(1).map((p) =>
          mesesSinRegistro.includes(p.mes) ? (
            // mes sin dato: círculo hueco (el valor es el del mes anterior, contado como cero)
            <circle key={p.mes} cx={x(p.mes)} cy={y(p.v)} r="4" fill="#ffffff" stroke={COLOR_REAL} strokeWidth="2" />
          ) : (
            <circle key={p.mes} cx={x(p.mes)} cy={y(p.v)} r="3.5" fill={COLOR_REAL} />
          ),
        )}
      </svg>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
        <span className="inline-flex items-center gap-2">
          <svg width="28" height="8" aria-hidden="true">
            <line x1="0" x2="28" y1="4" y2="4" stroke={COLOR_PLAN} strokeWidth="2.5" strokeDasharray="7 4" />
          </svg>
          Planificado
        </span>
        <span className="inline-flex items-center gap-2">
          <svg width="28" height="8" aria-hidden="true">
            <line x1="0" x2="28" y1="4" y2="4" stroke={COLOR_REAL} strokeWidth="2.5" />
          </svg>
          Real
        </span>
        {mesesSinRegistro.length > 0 && (
          <span className="inline-flex items-center gap-2">
            <svg width="12" height="12" aria-hidden="true">
              <circle cx="6" cy="6" r="4" fill="#ffffff" stroke={COLOR_REAL} strokeWidth="2" />
            </svg>
            Mes sin registro
          </span>
        )}
      </div>
    </div>
  );
}
