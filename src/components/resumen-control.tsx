import Link from "next/link";
import type { ReactNode } from "react";
import { Ayuda } from "@/components/ayuda";
import { Semaforo } from "@/components/semaforo";
import { pesosCorto } from "@/lib/informe/modelo";
import { indice } from "@/lib/pmo/formato";
import type { FilaPortafolio } from "@/lib/pmo/portafolio";
import type { TemaAyuda } from "@/lib/glosario";

// Resumen de control del proyecto (lado derecho del gráfico de avance): estado, índices, presupuesto,
// riesgos, cambios y decisiones. Todo sale de los datos ya calculados; no se digita nada.
const NIVEL = { critico: "Crítico", alto: "Alto", medio: "Medio", bajo: "Bajo" } as const;
const etiqueta = "text-xs font-medium uppercase tracking-wider text-leaf-800";
const valor = "mt-1 font-display text-2xl font-bold text-leaf-700";
const sub = "mt-0.5 text-xs text-muted";

function Tarjeta({ clase = "", tema, href, children }: { clase?: string; tema?: TemaAyuda; href?: string; children: ReactNode }) {
  const caja = "block rounded-card p-4 lg:flex lg:h-full lg:flex-col lg:justify-center";
  const contenido = href ? <Link href={href} className={`${caja} hover:shadow-card`}>{children}</Link> : <div className={caja}>{children}</div>;
  const base = `rounded-card bg-leaf-100 lg:h-full ${clase}`;
  return tema ? <Ayuda modo="tarjeta" tema={tema} className={base}>{contenido}</Ayuda> : <div className={base}>{contenido}</div>;
}

export function ResumenControl({ id, resumen, riesgos, decisiones }: { id: string; resumen: FilaPortafolio; riesgos: { activos: number; criticos: number }; decisiones: string[] }) {
  const m = resumen.medicion;
  const pesos = (c: bigint) => Number(c) / 100;
  const bac = m ? pesos(m.bac) : null;
  const ac = m ? pesos(m.ac) : null;
  const eac = resumen.evm?.eac != null ? pesos(resumen.evm.eac) : null;
  const vac = bac !== null && eac !== null ? bac - eac : null;
  const base = `/proyectos/${id}`;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:grid-rows-3">
      <Tarjeta clase="col-span-2 lg:col-span-1" tema="semaforo">
        <p className={`pr-5 ${etiqueta}`}>Estado calculado</p>
        <div className="mt-2"><Semaforo color={resumen.semaforo.general} /></div>
        {resumen.reporte && <p className="mt-2 text-xs text-muted">Reportado por el gerente: {resumen.reporte.estado_reportado}</p>}
      </Tarjeta>
      <Tarjeta tema="spi" href={`${base}/evm`}>
        <p className={`pr-5 ${etiqueta}`}>Cronograma (SPI)</p>
        <p className={valor}>{indice(resumen.evm?.spi ?? null)}</p>
      </Tarjeta>
      <Tarjeta tema="cpi" href={`${base}/evm`}>
        <p className={`pr-5 ${etiqueta}`}>Costo (CPI)</p>
        <p className={valor}>{indice(resumen.evm?.cpi ?? null)}</p>
      </Tarjeta>

      <Tarjeta clase="col-span-2 lg:col-span-3" href={`${base}/evm`}>
        {m ? (
          <div className="grid grid-cols-3 gap-3">
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
            <p className={etiqueta}>Presupuesto y costo</p>
            <p className={sub}>Aún no hay mediciones de valor ganado. Se registran en «Valor ganado».</p>
          </>
        )}
      </Tarjeta>

      <Tarjeta tema="riesgo_puntaje" href={`${base}/r/riesgos`}>
        <p className={`pr-5 ${etiqueta}`}>Riesgos activos</p>
        <p className={valor}>{riesgos.activos}</p>
        <p className={sub}>{riesgos.activos === 0 ? "Sin riesgos registrados" : `${riesgos.criticos} crítico(s)${resumen.riesgoMaximo ? ` · máximo: ${NIVEL[resumen.riesgoMaximo]}` : ""}`}</p>
      </Tarjeta>
      <Tarjeta tema="cambios_pendientes" href={`${base}/cambios`}>
        <p className={`pr-5 ${etiqueta}`}>Cambios pendientes</p>
        <p className={valor}>{resumen.cambiosPendientes}</p>
        <p className={sub}>{resumen.cambioCriticoPendientes} crítico(s)</p>
      </Tarjeta>
      <Tarjeta clase="col-span-2 lg:col-span-1" href="/">
        <p className={etiqueta}>Requiere decisión</p>
        <p className={valor}>{decisiones.length}</p>
        <p className={sub}>{decisiones.length === 0 ? "Nada pendiente de la dirección" : [...new Set(decisiones)].slice(0, 2).join(" · ")}</p>
      </Tarjeta>
    </div>
  );
}
