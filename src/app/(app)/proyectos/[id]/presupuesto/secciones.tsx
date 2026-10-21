import { TarjetaMuesca } from "@/components/tarjeta-muesca";
import type { ReactNode } from "react";
import { Ayuda } from "@/components/ayuda";
import { temaDe, type TemaAyuda } from "@/lib/glosario";
import Link from "next/link";
import type { Presupuesto } from "@/lib/presupuesto/calculos";
import type { Indicadores, SerieCurva } from "@/lib/presupuesto/curva";
import { ESCALA, formatearDecimal, formatearPesos } from "@/lib/presupuesto/dinero";
import { CurvaS } from "@/components/curva-s";
import { BotonEnviar } from "@/components/boton-enviar";
import { claseBoton } from "@/components/ui";
import { nivelPorDefecto, opcionesDeNivel, type ElementoEdt } from "@/lib/presupuesto/edt";

const NUMERO = "px-3 py-2 text-right tabular-nums whitespace-nowrap";
const CELDA = "px-3 py-2";

export const porcentaje = (n: number | null, conSigno = false) =>
  n === null
    ? "—"
    : `${conSigno && n > 0 ? "+" : ""}${n.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;

const precio = (p: bigint) => formatearDecimal(p, ESCALA.precio, p % 100n === 0n ? 0 : 2);

function Seccion({ id, titulo, children, nota, tema }: { id: string; titulo: string; children: ReactNode; nota?: ReactNode; tema?: TemaAyuda }) {
  return (
    <section className="mt-10" aria-labelledby={id}>
      <h2 id={id} className="flex items-center gap-2 font-display text-2xl font-bold text-leaf-700">
        {titulo}
        {tema && <Ayuda tema={tema} />}
      </h2>
      {nota && <p className="mt-1 text-sm text-muted">{nota}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Tarjeta({ titulo, valor, detalle }: { titulo: string; valor: string; detalle?: string }) {
  return (
    <TarjetaMuesca titulo={titulo} tema={temaDe(titulo)}>
      <p className="mt-1 font-display text-xl font-bold [overflow-wrap:anywhere] sm:text-2xl text-leaf-900 tabular-nums">{valor}</p>
      {detalle && <p className="mt-1 text-xs text-muted">{detalle}</p>}
    </TarjetaMuesca>
  );
}

export function SeccionIndicadores({ indicadores: i, hayPresupuesto, avanceFisico }: { indicadores: Indicadores; hayPresupuesto: boolean; avanceFisico?: number | null }) {
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
        <Tarjeta titulo="Avance físico" valor={avanceFisico === null || avanceFisico === undefined ? "Pendiente" : porcentaje(avanceFisico)} detalle={avanceFisico === null || avanceFisico === undefined ? "Se calcula con el cronograma: crea las tareas y sus pesos" : "Del cronograma (peso × avance de cada tarea)"} />
      </div>
      {i.mesesSinRegistro.length > 0 && (
        <p role="status" className="mt-3 rounded-[20px] border border-leaf-300 bg-leaf-50 px-3.5 py-2.5 text-sm text-leaf-800">
          {i.mesesSinRegistro.length === 1 ? "Falta registrar el gasto del mes" : "Faltan por registrar los meses"}{" "}
          {i.mesesSinRegistro.join(", ")}. Mientras tanto cuentan como cero.
        </p>
      )}
    </section>
  );
}

export function SeccionCurva({ serie, desdeCronograma = false }: { serie: SerieCurva; desdeCronograma?: boolean }) {
  return (
    <Seccion
      id="curva"
      titulo="Curva S"
      tema="curva_s"
      nota={desdeCronograma ? "El planificado se calcula desde el cronograma: cada tarea reparte su peso a lo largo de su duración." : "El planificado usa una distribución teórica (3t² − 2t³) mientras no haya cronograma con tareas y pesos."}
    >
      <CurvaS puntos={serie.puntos} mesesSinRegistro={serie.mesesSinRegistro} />
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer font-medium text-leaf-600">Ver los datos de la curva</summary>
        <div className="mt-2 overflow-x-auto rounded-card border border-soil-border">
          <table className="w-full min-w-[420px] text-sm">
            <thead className="border-b-[1.5px] border-leaf-500 text-left font-medium text-leaf-500">
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

export function SeccionPartidas({
  presupuesto,
  hrefEditar,
  codigosEdt,
}: {
  presupuesto: Presupuesto;
  hrefEditar?: (idPartida: string) => string;
  codigosEdt?: Map<string, string>; // id del elemento de la EDT → su código
}) {
  const conAcciones = !!hrefEditar;
  return (
    <Seccion id="partidas" titulo="Presupuesto por capítulos" nota="Valores en pesos colombianos (COP).">
      {presupuesto.capitulos.length === 0 ? (
        <p className="rounded-card border-[1.5px] border-soil-border p-6 text-center text-sm text-muted">
          Este proyecto aún no tiene presupuesto.{" "}
          {conAcciones
            ? "Impórtalo desde un archivo CSV o agrega las partidas una a una con los botones de arriba."
            : "Quien administra el proyecto puede cargarlo."}
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
                {conAcciones && (
                  <th scope="col" className={CELDA}>
                    <span className="sr-only">Acciones</span>
                  </th>
                )}
              </tr>
            </thead>
            {presupuesto.capitulos.map((c) => (
              <tbody key={c.id}>
                <tr className="bg-leaf-100 font-medium text-leaf-900">
                  <th scope="rowgroup" colSpan={5} className={`${CELDA} text-left`}>
                    {c.codigo}. {c.nombre}{" "}
                    {c.wbsId && codigosEdt?.get(c.wbsId) && <span className="mr-1 rounded-full bg-white/80 px-2 py-0.5 text-xs font-medium text-leaf-700">EDT {codigosEdt.get(c.wbsId)}</span>}
                    <span className="font-normal text-muted">({porcentaje(c.participacion)} del costo directo)</span>
                  </th>
                  <td className={NUMERO}>{formatearPesos(c.subtotal)}</td>
                  {conAcciones && <td />}
                </tr>
                {c.partidas.map((p) => (
                  <tr key={p.id} className="border-t border-soil-border">
                    <td className={`${CELDA} whitespace-nowrap`}>{p.codigo}</td>
                    <td className={CELDA}>{p.descripcion}</td>
                    <td className={CELDA}>{p.unidad}</td>
                    <td className={NUMERO}>{formatearDecimal(p.cantidad, ESCALA.cantidad)}</td>
                    <td className={NUMERO}>{precio(p.precio)}</td>
                    <td className={NUMERO}>{formatearPesos(p.total)}</td>
                    {conAcciones && (
                      <td className={`${CELDA} text-right`}>
                        <Link href={hrefEditar(p.id)} className="font-medium text-leaf-600 underline">
                          Editar
                        </Link>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            ))}
            <tfoot>
              <tr className="border-t-2 border-leaf-700 bg-leaf-50 font-bold text-leaf-900">
                <th scope="row" colSpan={5} className={`${CELDA} text-left`}>Costo directo total</th>
                <td className={NUMERO}>{formatearPesos(presupuesto.costoDirecto)}</td>
                {conAcciones && <td />}
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
        <p className="rounded-card border-[1.5px] border-soil-border p-6 text-center text-sm text-muted">
          Aún no se han configurado costos adicionales; por ahora el costo total es igual al costo directo.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-card border border-soil-border">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="border-b-[1.5px] border-leaf-500 text-left font-medium text-leaf-500">
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
          <thead className="border-b-[1.5px] border-leaf-500 text-left font-medium text-leaf-500">
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

// Crear los capítulos del presupuesto a partir de la EDT (solo para quien edita el presupuesto).
export function SeccionCapitulosEdt({ idProyecto, elementos, accion, nCapitulos }: { idProyecto: string; elementos: ElementoEdt[]; accion: (datos: FormData) => Promise<void>; nCapitulos: number }) {
  const opciones = opcionesDeNivel(elementos);
  return (
    <section className="mt-8 rounded-card border border-soil-border p-5" aria-labelledby="t-edt">
      <h2 id="t-edt" className="font-display text-lg font-bold text-leaf-700">Presupuesto sobre la EDT</h2>
      {elementos.length === 0 ? (
        <p className="mt-1 text-sm text-muted">
          Si primero armas la <Link href={`/proyectos/${idProyecto}/r/wbs`} className="font-medium text-leaf-600 underline">EDT</Link>, aquí podrás crear los capítulos del presupuesto a partir de sus elementos. También puedes presupuestar con capítulos propios, como hasta ahora.
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted">
            Crea los capítulos a partir de los elementos de la EDT de un nivel y luego agrega las partidas bajo cada capítulo. Si ya existe un capítulo con el mismo nombre, se liga en vez de duplicarse. Los capítulos ligados a la EDT no se borran aunque estén vacíos.
            {nCapitulos > 0 && " Puedes repetirlo con otro nivel: solo se agregan los que faltan."}
          </p>
          <form action={accion} className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1.5 text-[13px] font-medium text-leaf-800">
              Nivel de la EDT
              <select name="nivel" defaultValue={String(nivelPorDefecto(opciones))} className="h-[42px] rounded-[20px] border border-soil-border bg-white px-3 text-[15px] font-normal text-leaf-900 focus:border-leaf-500 focus:outline-none focus:ring-[3px] focus:ring-leaf-500/30">
                {opciones.map((o) => <option key={o.nivel} value={o.nivel}>{o.etiqueta}</option>)}
              </select>
            </label>
            <BotonEnviar className={claseBoton.secundario} textoEnviando="Creando…">Crear capítulos desde la EDT</BotonEnviar>
          </form>
        </>
      )}
    </section>
  );
}
