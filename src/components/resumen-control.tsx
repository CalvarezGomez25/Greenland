import { TarjetaMuesca } from "@/components/tarjeta-muesca";
import { Semaforo } from "@/components/semaforo";
import { pesosCorto } from "@/lib/informe/modelo";
import { indice } from "@/lib/pmo/formato";
import type { FilaPortafolio } from "@/lib/pmo/portafolio";

// Resumen de control del proyecto (lado derecho del gráfico de avance): estado, índices, presupuesto,
// riesgos, cambios y decisiones. Todo sale de los datos ya calculados; no se digita nada.
const NIVEL = { critico: "Crítico", alto: "Alto", medio: "Medio", bajo: "Bajo" } as const;
const etiqueta = "text-xs font-medium text-leaf-800";
const valor = "mt-1 whitespace-nowrap font-display text-xl font-light text-leaf-500 sm:text-3xl";
const sub = "mt-0.5 text-xs text-muted";

export function ResumenControl({ id, resumen, riesgos, decisiones, hrefTablero = "/" }: { id: string; resumen: FilaPortafolio; riesgos: { activos: number; criticos: number }; decisiones: string[]; hrefTablero?: string }) {
  const m = resumen.medicion;
  const pesos = (c: bigint) => Number(c) / 100;
  const bac = m ? pesos(m.bac) : null;
  const ac = m ? pesos(m.ac) : null;
  const eac = resumen.evm?.eac != null ? pesos(resumen.evm.eac) : null;
  const vac = bac !== null && eac !== null ? bac - eac : null;
  const base = `/proyectos/${id}`;
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-5 lg:grid-cols-3 lg:grid-rows-3">
      <TarjetaMuesca titulo="Estado calculado" clase="col-span-2 lg:col-span-1" tema="semaforo">
        <div><Semaforo color={resumen.semaforo.general} /></div>
        {resumen.reporte && <p className="mt-2 text-xs text-muted">Reportado por el gerente: {resumen.reporte.estado_reportado}</p>}
      </TarjetaMuesca>
      <TarjetaMuesca titulo="Cronograma (SPI)" tema="spi" href={`${base}/evm`}>
        <p className={valor}>{indice(resumen.evm?.spi ?? null)}</p>
      </TarjetaMuesca>
      <TarjetaMuesca titulo="Costo (CPI)" tema="cpi" href={`${base}/evm`}>
        <p className={valor}>{indice(resumen.evm?.cpi ?? null)}</p>
      </TarjetaMuesca>

      <TarjetaMuesca titulo="Presupuesto y costo" clase="col-span-2 lg:col-span-3" href={`${base}/evm`}>
        {m ? (
          <div className="grid w-full grid-cols-3 gap-3">
            <div><p className={etiqueta}>Presupuesto (BAC)</p><p className={valor}>{pesosCorto(bac)}</p><p className={sub}>COP</p></div>
            <div><p className={etiqueta}>Costo real (AC)</p><p className={valor}>{pesosCorto(ac)}</p><p className={sub}>al corte de la última medición</p></div>
            <div>
              <p className={etiqueta}>Proyección final (EAC)</p>
              <p className={valor}>{pesosCorto(eac)}</p>
              <p className={sub}>{vac === null ? "Requiere costo real y avance" : `${vac >= 0 ? "Ahorro" : "Sobrecosto"} previsto: ${pesosCorto(Math.abs(vac))}`}</p>
            </div>
          </div>
        ) : (
          <>
            <p className={sub}>Aún no hay mediciones de valor ganado. Se registran en «Valor ganado».</p>
          </>
        )}
      </TarjetaMuesca>

      <TarjetaMuesca titulo="Riesgos activos" tema="riesgo_puntaje" href={`${base}/r/riesgos`}>
        <p className={valor}>{riesgos.activos}</p>
        <p className={sub}>{riesgos.activos === 0 ? "Sin riesgos registrados" : `${riesgos.criticos} crítico(s)${resumen.riesgoMaximo ? ` · máximo: ${NIVEL[resumen.riesgoMaximo]}` : ""}`}</p>
      </TarjetaMuesca>
      <TarjetaMuesca titulo="Cambios pendientes" tema="cambios_pendientes" href={`${base}/cambios`}>
        <p className={valor}>{resumen.cambiosPendientes}</p>
        <p className={sub}>{resumen.cambioCriticoPendientes} crítico(s)</p>
      </TarjetaMuesca>
      <TarjetaMuesca titulo="Requiere decisión" clase="col-span-2 lg:col-span-1" href={hrefTablero}>
        <p className={valor}>{decisiones.length}</p>
        <p className={sub}>{decisiones.length === 0 ? "Nada pendiente de la dirección" : [...new Set(decisiones)].slice(0, 2).join(" · ")}</p>
      </TarjetaMuesca>
    </div>
  );
}
