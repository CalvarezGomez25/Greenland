import { Suspense } from "react";
import Link from "next/link";
import { cargarContexto } from "@/lib/presupuesto/contexto";
import { calcularPresupuesto } from "@/lib/presupuesto/calculos";
import { cargarDatosPresupuesto } from "@/lib/presupuesto/datos";
import { cargarDatosBalance } from "@/lib/presupuesto/balance-datos";
import { calcularBalance, ETIQUETA_ESTADO_ADICIONAL, type FilaBalance } from "@/lib/presupuesto/balance";
import { formatearPesos } from "@/lib/presupuesto/dinero";
import { ETIQUETA_TIPO_CONTRATO } from "@/lib/obra/contratos";
import { Titulo } from "@/components/ui";

const TH = "px-3 py-2 text-right font-medium";
const TD = "px-3 py-2 text-right tabular-nums";

function Barra({ f }: { f: FilaBalance }) {
  const p = f.pctContratado;
  if (p === null) return <span className="text-muted">—</span>;
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="h-2 w-20 overflow-hidden rounded-full bg-leaf-100" aria-hidden="true">
        <div className={`h-full ${f.sobrecontratado ? "bg-danger" : "bg-leaf-600"}`} style={{ width: `${Math.min(100, p)}%` }} />
      </div>
      <span className={f.sobrecontratado ? "font-medium text-danger" : ""}>{p.toLocaleString("es-CO", { minimumFractionDigits: 1 })} %</span>
    </div>
  );
}

function Filas({ filas, total }: { filas: FilaBalance[]; total?: FilaBalance }) {
  return (
    <>
      {filas.map((f) => (
        <tr key={f.id} className="border-t border-soil-border">
          <td className="px-3 py-2"><span className="font-medium">{f.codigo}</span> {f.nombre}{f.estado && f.estado !== "aprobado" && <span className="ml-2 rounded-full bg-leaf-100 px-2 py-0.5 text-xs">{ETIQUETA_ESTADO_ADICIONAL[f.estado]}</span>}</td>
          <td className={TD}>{formatearPesos(f.presupuestoDirecto)}</td>
          <td className={TD}>{formatearPesos(f.presupuesto)}</td>
          <td className={TD}>{formatearPesos(f.contratado)}{f.porAprobar > 0n && <p className="text-xs text-muted">+ {formatearPesos(f.porAprobar)} por aprobar</p>}</td>
          <td className={TD}>{formatearPesos(f.facturado)}</td>
          <td className={`${TD} ${f.sobrecontratado ? "font-medium text-danger" : ""}`}>{formatearPesos(f.saldo)}</td>
          <td className="px-3 py-2 text-right"><Barra f={f} /></td>
        </tr>
      ))}
      {total && (
        <tr className="border-t-2 border-leaf-700 bg-leaf-50 font-bold text-leaf-900">
          <th scope="row" className="px-3 py-2 text-left">{total.nombre}</th>
          <td className={TD}>{formatearPesos(total.presupuestoDirecto)}</td>
          <td className={TD}>{formatearPesos(total.presupuesto)}</td>
          <td className={TD}>{formatearPesos(total.contratado)}</td>
          <td className={TD}>{formatearPesos(total.facturado)}</td>
          <td className={`${TD} ${total.sobrecontratado ? "text-danger" : ""}`}>{formatearPesos(total.saldo)}</td>
          <td className="px-3 py-2 text-right"><Barra f={total} /></td>
        </tr>
      )}
    </>
  );
}

function Encabezado() {
  return (
    <thead className="bg-leaf-100 text-xs uppercase tracking-wider text-leaf-800">
      <tr>
        <th scope="col" className="px-3 py-2 text-left font-medium">Capítulo / adicional</th>
        <th scope="col" className={TH}>Presupuesto directo</th>
        <th scope="col" className={TH}>Con indirectos</th>
        <th scope="col" className={TH}>Contratado</th>
        <th scope="col" className={TH}>Facturado</th>
        <th scope="col" className={TH}>Saldo</th>
        <th scope="col" className={TH}>% contratado</th>
      </tr>
    </thead>
  );
}

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, proyecto } = await cargarContexto(id);
  const base = `/proyectos/${id}`;
  const presupuesto = calcularPresupuesto(await cargarDatosPresupuesto(supabase, id));
  const datos = await cargarDatosBalance(supabase, id);
  const b = calcularBalance({ presupuesto, ...datos });
  const aprobados = b.adicionales.filter((f) => f.estado === "aprobado");
  const otros = b.adicionales.filter((f) => f.estado !== "aprobado");
  const sobre = [...b.capitulos, ...aprobados].filter((f) => f.sobrecontratado);

  return (
    <>
      <Link href={`${base}/presupuesto`} className="text-sm font-medium text-leaf-600 hover:underline">← Volver al presupuesto</Link>
      <div className="mt-4"><Titulo>Balance de costos y contratos</Titulo></div>
      <p className="mt-3 text-sm text-muted">{proyecto.nombre}</p>
      <p className="mt-3 max-w-3xl text-sm">
        Lo presupuestado de cada capítulo (con su parte de los costos indirectos A.I.U.) frente a lo contratado, según el reparto que se hace en cada{" "}
        <Link href={`${base}/contratos`} className="font-medium text-leaf-600 underline">contrato</Link>. Cuentan solo los contratos aprobados; lo facturado se reparte
        en proporción a lo asignado a cada línea. Los <Link href={`${base}/presupuesto/adicionales`} className="font-medium text-leaf-600 underline">adicionales</Link> aprobados
        suman al total; los que están en trámite se muestran aparte.
      </p>

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Resumen del balance">
        {([
          ["Presupuesto con indirectos", formatearPesos(b.total.presupuesto)], ["Contratado", formatearPesos(b.total.contratado)],
          ["Saldo por contratar", formatearPesos(b.total.saldo)], ["Facturado", formatearPesos(b.total.facturado)],
        ] as [string, string][]).map(([t, v]) => (
          <div key={t} className="rounded-card bg-leaf-100 p-4"><p className="text-xs font-medium uppercase tracking-wider text-leaf-800">{t}</p><p className="mt-1 font-display text-xl font-bold text-leaf-700">{v}</p><p className="text-xs text-muted">COP</p></div>
        ))}
      </section>

      {(sobre.length > 0 || b.totalSinAsignar > 0n) && (
        <div role="status" className="mt-4 rounded-card border border-soil-border bg-leaf-50 p-4 text-sm">
          {sobre.length > 0 && <p><strong>Sobrecontratado:</strong> {sobre.map((f) => `${f.codigo} ${f.nombre}`).join("; ")}. Revisa si falta un adicional aprobado o si el reparto del contrato es correcto.</p>}
          {b.totalSinAsignar > 0n && <p className={sobre.length > 0 ? "mt-2" : ""}><strong>Contratos sin asignar:</strong> {formatearPesos(b.totalSinAsignar)} COP de contratos aprobados aún no están repartidos entre capítulos o adicionales.</p>}
        </div>
      )}

      <section className="mt-8" aria-labelledby="t-cap">
        <h2 id="t-cap" className="font-display text-2xl font-bold text-leaf-700">Capítulos del presupuesto</h2>
        {b.capitulos.length === 0 ? (
          <p className="mt-3 rounded-card bg-leaf-50 p-5 text-sm text-muted">Aún no hay capítulos. Importa o registra el presupuesto primero.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-card border border-soil-border">
            <table className="w-full min-w-[900px] text-sm"><Encabezado /><tbody><Filas filas={b.capitulos} total={b.totalCapitulos} /></tbody></table>
          </div>
        )}
      </section>

      <section className="mt-8" aria-labelledby="t-ad">
        <h2 id="t-ad" className="font-display text-2xl font-bold text-leaf-700">Adicionales de obra</h2>
        {b.adicionales.length === 0 ? (
          <p className="mt-3 rounded-card bg-leaf-50 p-5 text-sm text-muted">No hay adicionales registrados.</p>
        ) : (
          <>
            <div className="mt-3 overflow-x-auto rounded-card border border-soil-border">
              <table className="w-full min-w-[900px] text-sm"><Encabezado /><tbody>
                <Filas filas={aprobados} total={aprobados.length > 0 ? b.totalAdicionalesAprobados : undefined} />
                <Filas filas={otros} />
              </tbody></table>
            </div>
            {b.adicionalesEnTramite > 0n && <p className="mt-2 text-sm text-muted">En trámite o rechazados no suman al total. En trámite: {formatearPesos(b.adicionalesEnTramite)} COP con indirectos.</p>}
          </>
        )}
      </section>

      <section className="mt-8" aria-labelledby="t-sin">
        <h2 id="t-sin" className="font-display text-2xl font-bold text-leaf-700">Contratos con valor sin asignar</h2>
        {b.sinAsignar.length === 0 ? (
          <p className="mt-3 rounded-card bg-leaf-50 p-5 text-sm text-muted">Todos los contratos están asignados por completo.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-card border border-soil-border">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-leaf-100 text-xs uppercase tracking-wider text-leaf-800"><tr><th className="px-3 py-2 text-left font-medium">Contrato</th><th className={TH}>Valor</th><th className={TH}>Sin asignar</th></tr></thead>
              <tbody>
                {b.sinAsignar.map((c) => (
                  <tr key={c.contratoId} className="border-t border-soil-border">
                    <td className="px-3 py-2"><Link href={`${base}/contratos/${c.contratoId}`} className="font-medium text-leaf-700 hover:underline">{c.contratista}</Link>{!c.aprobado && <span className="ml-2 rounded-full bg-leaf-100 px-2 py-0.5 text-xs">Pendiente de aprobación</span>}<p className="text-xs text-muted">{ETIQUETA_TIPO_CONTRATO[c.tipo]}</p></td>
                    <td className={TD}>{formatearPesos(c.valor)}</td>
                    <td className={TD}>{formatearPesos(c.sinAsignar)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

export default function PaginaBalance({ params }: PageProps<"/proyectos/[id]/presupuesto/balance">) {
  return <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><Contenido params={params} /></Suspense>;
}
