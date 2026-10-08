import type { ReactNode } from "react";
import type { Presupuesto } from "@/lib/presupuesto/calculos";
import type { Indicadores, SerieCurva } from "@/lib/presupuesto/curva";
import { ESCALA, formatearDecimal, formatearPesos } from "@/lib/presupuesto/dinero";
import { CurvaS } from "@/components/curva-s";

const NUMERO = "px-3 py-2 text-right tabular-nums whitespace-nowrap";
const CELDA = "px-3 py-2";

export const porcentaje = (n: number | null, conSigno = false) =>
  n === null
    ? "—"
    : `${conSigno && n > 0 ? "+" : ""}${n.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;

const precio = (p: bigint) => formatearDecimal(p, ESCALA.precio, p % 100n === 0n ? 0 : 2);

function Seccion({ id, titulo, children, nota }: { id: string; titulo: string; children: ReactNode; nota?: ReactNode }) {
  return (
    <section className="mt-10" aria-labelledby={id}>
      <h2 id={id} className="font-display text-2xl font-bold text-leaf-700">
        {titulo}
      </h2>
      {nota && <p className="mt-1 text-sm text-muted">{nota}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Tarjeta({ titulo, valor, detalle }: { titulo: string; valor: string; detalle?: string }) {
  return (
    <div className="rounded-card bg-leaf-100 p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-leaf-800">{titulo}</p>
      <p className="mt-1 font-display text-2xl font-bold text-leaf-900 tabular-nums">{valor}</p>
      {detalle && <p className="mt-1 text-xs text-muted">{detalle}</p>}
    </div>
  );
}

export function SeccionIndicadores({ indicadores: i, hayPresupuesto }: { indicadores: Indicadores; hayPresupuesto: boolean }) {
  return (
    <section aria-label="Indicadores" className="mt-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Tarjeta titulo="Costo directo" valor={`$ ${formatearPesos(i.costoDirecto)}`} detalle="Suma de cantidad × precio de las partidas" />
        <Tarjeta
          titulo="Costo total"
          valor={`$ ${formatearPesos(i.costoTotal)}`}
          detalle="Costo directo más costos adicionales"
        />
        <Tarjeta
          titulo="Gastado a la fecha"
          valor={`$ ${formatearPesos(i.gastadoALaFecha)}`}
          detalle={i.mesDeCorte > 0 ? `Hasta el mes ${i.mesDeCorte}` : "Aún no hay gasto registrado"}
        />
        <Tarjeta
          titulo="Avance financiero"
          valor={hayPresupuesto ? porcentaje(i.avanceFinanciero) : "—"}
          detalle="Gastado ÷ costo total"
        />
        <Tarjeta
          titulo="Gasto frente al plan"
          valor={porcentaje(i.desviacion, true)}
          detalle={
            i.desviacion === null
              ? "Se calcula cuando hay gasto registrado"
              : "Positivo: se ha gastado más de lo planificado"
          }
        />
        <Tarjeta titulo="Avance físico" valor="Pendiente" detalle="Se calcula con el cronograma (Hito 3)" />
      </div>
      {i.mesesSinRegistro.length > 0 && (
        <p role="status" className="mt-3 rounded-[10px] border border-leaf-300 bg-leaf-50 px-3.5 py-2.5 text-sm text-leaf-800">
          {i.mesesSinRegistro.length === 1 ? "Falta registrar el gasto del mes" : "Faltan por registrar los meses"}{" "}
          {i.mesesSinRegistro.join(", ")}. Mientras tanto cuentan como cero.
        </p>
      )}
    </section>
  );
}

export function SeccionCurva({ serie }: { serie: SerieCurva }) {
  return (
    <Seccion
      id="curva"
      titulo="Curva S"
      nota="El planificado usa una distribución teórica (3t² − 2t³) hasta que exista el cronograma (Hito 3)."
    >
      <CurvaS puntos={serie.puntos} mesesSinRegistro={serie.mesesSinRegistro} />
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer font-medium text-leaf-600">Ver los datos de la curva</summary>
        <div className="mt-2 overflow-x-auto rounded-card border border-soil-border">
          <table className="w-full min-w-[420px] text-sm">
            <thead className="bg-leaf-100 text-left text-leaf-800">
              <tr>
                <th scope="col" className={CELDA}>Mes</th>
                <th scope="col" className={`${NUMERO} font-medium`}>Planificado acumulado</th>
                <th scope="col" className={`${NUMERO} font-medium`}>Real acumulado</th>
              </tr>
            </thead>
            <tbody>
              {serie.puntos.map((p) => (
                <tr key={p.mes} className="border-t border-soil-border">
                  <td className={CELDA}>{p.mes}</td>
                  <td className={NUMERO}>{formatearPesos(p.planificado)}</td>
                  <td className={NUMERO}>{p.real === null ? "—" : formatearPesos(p.real)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </Seccion>
  );
}

export function SeccionPartidas({ presupuesto }: { presupuesto: Presupuesto }) {
  return (
    <Seccion id="partidas" titulo="Presupuesto por capítulos" nota="Valores en pesos colombianos (COP).">
      {presupuesto.capitulos.length === 0 ? (
        <p className="rounded-card bg-leaf-50 p-6 text-center text-sm text-muted">
          Este proyecto aún no tiene presupuesto. La carga de partidas (importar un CSV o agregarlas a mano) estará
          disponible en la siguiente entrega.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-card border border-soil-border">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-leaf-700 text-left text-white">
              <tr>
                <th scope="col" className={CELDA}>Código</th>
                <th scope="col" className={CELDA}>Descripción</th>
                <th scope="col" className={CELDA}>Unidad</th>
                <th scope="col" className={`${NUMERO} font-medium`}>Cantidad</th>
                <th scope="col" className={`${NUMERO} font-medium`}>Precio unitario</th>
                <th scope="col" className={`${NUMERO} font-medium`}>Total</th>
              </tr>
            </thead>
            {presupuesto.capitulos.map((c) => (
              <tbody key={c.id}>
                <tr className="bg-leaf-100 font-medium text-leaf-900">
                  <th scope="rowgroup" colSpan={5} className={`${CELDA} text-left`}>
                    {c.codigo}. {c.nombre}{" "}
                    <span className="font-normal text-muted">({porcentaje(c.participacion)} del costo directo)</span>
                  </th>
                  <td className={NUMERO}>{formatearPesos(c.subtotal)}</td>
                </tr>
                {c.partidas.map((p) => (
                  <tr key={p.id} className="border-t border-soil-border">
                    <td className={`${CELDA} whitespace-nowrap`}>{p.codigo}</td>
                    <td className={CELDA}>{p.descripcion}</td>
                    <td className={CELDA}>{p.unidad}</td>
                    <td className={NUMERO}>{formatearDecimal(p.cantidad, ESCALA.cantidad)}</td>
                    <td className={NUMERO}>{precio(p.precio)}</td>
                    <td className={NUMERO}>{formatearPesos(p.total)}</td>
                  </tr>
                ))}
              </tbody>
            ))}
            <tfoot>
              <tr className="border-t-2 border-leaf-700 bg-leaf-50 font-bold text-leaf-900">
                <th scope="row" colSpan={5} className={`${CELDA} text-left`}>Costo directo total</th>
                <td className={NUMERO}>{formatearPesos(presupuesto.costoDirecto)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Seccion>
  );
}

export function SeccionAdicionales({ presupuesto }: { presupuesto: Presupuesto }) {
  const nombrePorId = new Map(presupuesto.lineas.map((l) => [l.id, l.nombre]));
  return (
    <Seccion
      id="adicionales"
      titulo="Costos adicionales"
      nota="Porcentajes definidos por el proyecto (por ejemplo AIU, IVA sobre la utilidad y retefuente)."
    >
      {presupuesto.lineas.length === 0 ? (
        <p className="rounded-card bg-leaf-50 p-6 text-center text-sm text-muted">
          Aún no se han configurado costos adicionales; por ahora el costo total es igual al costo directo. La
          configuración estará disponible en la siguiente entrega.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-card border border-soil-border">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="bg-leaf-100 text-left text-leaf-800">
              <tr>
                <th scope="col" className={CELDA}>Concepto</th>
                <th scope="col" className={CELDA}>Se calcula sobre</th>
                <th scope="col" className={`${NUMERO} font-medium`}>Porcentaje</th>
                <th scope="col" className={`${NUMERO} font-medium`}>Valor</th>
              </tr>
            </thead>
            <tbody>
              {presupuesto.lineas.map((l) => (
                <tr key={l.id} className="border-t border-soil-border">
                  <td className={CELDA}>{l.nombre}</td>
                  <td className={CELDA}>
                    {l.base === "costo_directo" ? "Costo directo" : (nombrePorId.get(l.lineaBaseId ?? "") ?? "Otra línea")}
                  </td>
                  <td className={NUMERO}>{formatearDecimal(l.porcentaje, ESCALA.porcentaje)} %</td>
                  <td className={NUMERO}>{formatearPesos(l.valor)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="font-medium text-leaf-900">
              <tr className="border-t-2 border-leaf-700 bg-leaf-50">
                <th scope="row" colSpan={3} className={`${CELDA} text-left`}>Total costos adicionales</th>
                <td className={NUMERO}>{formatearPesos(presupuesto.totalAdicionales)}</td>
              </tr>
              <tr className="bg-leaf-50 font-bold">
                <th scope="row" colSpan={3} className={`${CELDA} text-left`}>Costo total (directo + adicionales)</th>
                <td className={NUMERO}>{formatearPesos(presupuesto.costoTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Seccion>
  );
}

export function SeccionGasto({
  serie,
  gastoPorMes,
  duracion,
}: {
  serie: SerieCurva;
  gastoPorMes: Map<number, bigint>;
  duracion: number;
}) {
  const meses = Math.max(duracion, serie.ultimoMes);
  const filas = Array.from({ length: meses }, (_, i) => i + 1);
  return (
    <Seccion id="gasto" titulo="Gasto real por mes" nota="Mes 1 es el primer mes del proyecto. Valores en pesos colombianos (COP).">
      <div className="overflow-x-auto rounded-card border border-soil-border">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="bg-leaf-100 text-left text-leaf-800">
            <tr>
              <th scope="col" className={CELDA}>Mes</th>
              <th scope="col" className={`${NUMERO} font-medium`}>Gasto del mes</th>
              <th scope="col" className={`${NUMERO} font-medium`}>Real acumulado</th>
              <th scope="col" className={`${NUMERO} font-medium`}>Planificado acumulado</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((mes) => {
              const gasto = gastoPorMes.get(mes);
              const faltante = gasto === undefined && mes <= serie.ultimoMes;
              const punto = serie.puntos[mes];
              return (
                <tr key={mes} className="border-t border-soil-border">
                  <td className={CELDA}>{mes}</td>
                  <td className={NUMERO}>
                    {gasto !== undefined ? formatearPesos(gasto) : faltante ? <span className="text-danger">Sin registro</span> : "—"}
                  </td>
                  <td className={NUMERO}>{punto.real === null ? "—" : formatearPesos(punto.real)}</td>
                  <td className={NUMERO}>{formatearPesos(punto.planificado)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Seccion>
  );
}
