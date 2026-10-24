import type { Corte } from "@/lib/pmo/cortes";

// Control de costos corte a corte, en SVG puro. Cada corte es una barra de lo proyectado (EAC): la parte sólida es lo
// invertido y la clara lo que falta por invertir. La línea discontinua marca la línea base de costo (BAC) de cada corte.
// Se dibuja en millones de pesos; los valores se convierten a número solo para dibujar. Las mediciones guardan
// el dinero con 2 decimales, de ahí la división por 1e8.

const ANCHO = 720;
const ALTO = 340;
const M = { izq: 70, der: 16, arr: 34, aba: 44 };
const C_INVERTIDO = "#4c700b";
const C_POR_INVERTIR = "#cfe3a8";
const C_BASE = "#7c401d";
const C_TEXTO = "#555552";
const C_REJILLA = "#dcdcd8";

const aMillones = (centavos: bigint) => Number(centavos) / 1e8;
const fmt = (n: number) => n.toLocaleString("es-CO", { maximumFractionDigits: 0 });
const fecha = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function GraficoCortes({ cortes }: { cortes: Corte[] }) {
  const maximo = Math.max(...cortes.map((c) => Math.max(aMillones(c.bac), aMillones(c.proyectado ?? c.invertido), aMillones(c.invertido))));
  if (cortes.length === 0 || !(maximo > 0)) return <p className="rounded-card bg-leaf-50 p-6 text-center text-sm text-muted">Sin cortes para graficar.</p>;

  const anchoUtil = ANCHO - M.izq - M.der;
  const altoUtil = ALTO - M.arr - M.aba;
  const banda = anchoUtil / cortes.length;
  const ancho = Math.min(64, banda * 0.6);
  const cx = (i: number) => M.izq + banda * (i + 0.5);
  const y = (v: number) => M.arr + altoUtil - (v / maximo) * altoUtil;
  const marcas = [0, 0.25, 0.5, 0.75, 1].map((f) => f * maximo);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} role="img" aria-label="Control de costos por corte: lo invertido y lo que falta por invertir hasta el costo proyectado, frente a la línea base de costo, en millones de pesos" className="h-auto w-full min-w-[640px]">
        {marcas.map((v) => (
          <g key={v}>
            <line x1={M.izq} x2={ANCHO - M.der} y1={y(v)} y2={y(v)} stroke={C_REJILLA} />
            <text x={M.izq - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill={C_TEXTO}>{fmt(v)}</text>
          </g>
        ))}
        <text x={M.izq} y={13} fontSize="11" fill={C_TEXTO}>Millones de pesos · eje horizontal: fecha de corte (día/mes)</text>

        {cortes.map((c, i) => {
          const inv = aMillones(c.invertido);
          const proy = c.proyectado === null ? null : aMillones(c.proyectado);
          const x0 = cx(i) - ancho / 2;
          return (
            <g key={c.fecha}>
              {proy !== null && proy > inv && <rect x={x0} y={y(proy)} width={ancho} height={y(inv) - y(proy)} fill={C_POR_INVERTIR} />}
              <rect x={x0} y={y(inv)} width={ancho} height={y(0) - y(inv)} fill={C_INVERTIDO} />
              <text x={cx(i)} y={(proy !== null ? y(proy) : y(inv)) - 6} textAnchor="middle" fontSize="11" fontWeight="600" fill={C_TEXTO}>{proy !== null ? fmt(proy) : "sin proyección"}</text>
              <text x={cx(i)} y={ALTO - 24} textAnchor="middle" fontSize="11" fill={C_TEXTO}>{fecha(c.fecha)}</text>
              <line x1={cx(i) - banda / 2 + 2} x2={cx(i) + banda / 2 - 2} y1={y(aMillones(c.bac))} y2={y(aMillones(c.bac))} stroke={C_BASE} strokeWidth="2.5" strokeDasharray="6 3" />
            </g>
          );
        })}

        <g transform={`translate(${M.izq}, ${ALTO - 10})`} fontSize="11" fill={C_TEXTO}>
          <rect x="0" y="-9" width="10" height="10" fill={C_INVERTIDO} /><text x="15" y="0">Invertido</text>
          <rect x="85" y="-9" width="10" height="10" fill={C_POR_INVERTIR} /><text x="100" y="0">Por invertir (hasta lo proyectado)</text>
          <line x1="285" x2="305" y1="-4" y2="-4" stroke={C_BASE} strokeWidth="2.5" strokeDasharray="6 3" /><text x="310" y="0">Línea base de costo (BAC)</text>
        </g>
      </svg>
    </div>
  );
}
