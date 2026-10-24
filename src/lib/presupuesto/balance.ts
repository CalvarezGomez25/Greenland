// Balance entre lo presupuestado y lo contratado, por capítulo y por adicional de obra.
//
// Conceptos (no confundirlos):
//  - Costos indirectos (A.I.U.): administración, imprevistos y utilidad como porcentajes del costo directo.
//  - Adicionales de obra: trabajos que no estaban contemplados en la EDT original o que llegaron como
//    añadidura durante la ejecución. Se aprueban por el control de cambios.
//
// Lo presupuestado de un capítulo se muestra en costo directo y «con indirectos» (se reparte el A.I.U. en
// proporción a su costo directo). Un contrato reparte su valor entre capítulos y adicionales (asignaciones);
// lo contratado y lo facturado se comparan contra lo «con indirectos», porque el valor de un contrato de obra
// suele incluir A.I.U. Lo facturado de un contrato se reparte en proporción a lo asignado a cada línea.
// Funciones puras (sin red) para poder probarlas. Todos los montos en escala 6 (ver dinero.ts).

import { conIndirectos, type Presupuesto } from "./calculos";
import { dividirRedondeado } from "./dinero";

export type EstadoAdicional = "identificado" | "aprobado" | "rechazado";
export const ETIQUETA_ESTADO_ADICIONAL: Record<EstadoAdicional, string> = {
  identificado: "En trámite", aprobado: "Aprobado", rechazado: "Rechazado",
};
export const ETIQUETA_ORIGEN_ADICIONAL: Record<string, string> = {
  no_contemplado: "No contemplado en la EDT original", anadidura: "Añadidura durante la ejecución",
};

// El estado de un adicional sale del cambio que lo respalda: sin cambio, o con el cambio aún en trámite, está «en trámite».
export function estadoDeAdicional(estadoFlujoDelCambio: string | null | undefined): EstadoAdicional {
  if (estadoFlujoDelCambio === "aprobado" || estadoFlujoDelCambio === "implementacion" || estadoFlujoDelCambio === "cerrado") return "aprobado";
  if (estadoFlujoDelCambio === "rechazado") return "rechazado";
  return "identificado";
}

export type AdicionalDato = {
  id: string; codigo: string; descripcion: string; origen: string;
  valorDirecto: bigint; aplicaIndirectos: boolean; estado: EstadoAdicional; cambioCodigo: string | null;
};
export type ContratoDato = { id: string; contratista: string; tipo: string; valor: bigint; aprobado: boolean; facturado: bigint };
export type AsignacionDato = { contratoId: string; capituloId: string | null; adicionalId: string | null; valor: bigint };

export type FilaBalance = {
  tipo: "capitulo" | "adicional";
  id: string;
  codigo: string;
  nombre: string;
  presupuestoDirecto: bigint;
  presupuesto: bigint; // con indirectos (si aplica)
  contratado: bigint; // solo contratos aprobados
  porAprobar: bigint; // asignado a contratos que esperan aprobación del director
  facturado: bigint;
  saldo: bigint; // presupuesto − contratado (negativo: sobrecontratado)
  pctContratado: number | null; // 0–100+, un decimal
  sobrecontratado: boolean;
  estado?: EstadoAdicional; // solo adicionales
};

export type Balance = {
  capitulos: FilaBalance[];
  adicionales: FilaBalance[]; // todos; los aprobados cuentan en el total, los demás se muestran aparte
  totalCapitulos: FilaBalance;
  totalAdicionalesAprobados: FilaBalance;
  total: FilaBalance; // capítulos + adicionales aprobados
  adicionalesEnTramite: bigint; // presupuesto con indirectos de los adicionales aún no aprobados
  sinAsignar: { contratoId: string; contratista: string; tipo: string; valor: bigint; sinAsignar: bigint; aprobado: boolean }[];
  totalSinAsignar: bigint; // solo contratos aprobados
};

const pct1 = (parte: bigint, total: bigint): number | null =>
  total > 0n ? Number(dividirRedondeado(parte * 1000n, total)) / 10 : null;

function fila(
  base: Pick<FilaBalance, "tipo" | "id" | "codigo" | "nombre" | "presupuestoDirecto" | "presupuesto" | "estado">,
  asignaciones: AsignacionDato[],
  contratos: Map<string, ContratoDato>,
): FilaBalance {
  let contratado = 0n, porAprobar = 0n, facturado = 0n;
  for (const a of asignaciones) {
    const c = contratos.get(a.contratoId);
    if (!c) continue;
    if (c.aprobado) contratado += a.valor; else porAprobar += a.valor;
    if (c.valor > 0n) facturado += dividirRedondeado(c.facturado * a.valor, c.valor);
  }
  const saldo = base.presupuesto - contratado;
  return { ...base, contratado, porAprobar, facturado, saldo, pctContratado: pct1(contratado, base.presupuesto), sobrecontratado: contratado > base.presupuesto };
}

function sumar(nombre: string, filas: FilaBalance[]): FilaBalance {
  const s = (f: (x: FilaBalance) => bigint) => filas.reduce((t, x) => t + f(x), 0n);
  const presupuesto = s((x) => x.presupuesto), contratado = s((x) => x.contratado);
  return {
    tipo: "capitulo", id: nombre, codigo: "", nombre,
    presupuestoDirecto: s((x) => x.presupuestoDirecto), presupuesto, contratado,
    porAprobar: s((x) => x.porAprobar), facturado: s((x) => x.facturado), saldo: presupuesto - contratado,
    pctContratado: pct1(contratado, presupuesto), sobrecontratado: contratado > presupuesto,
  };
}

export function calcularBalance(entrada: {
  presupuesto: Presupuesto;
  adicionales: AdicionalDato[];
  contratos: ContratoDato[];
  asignaciones: AsignacionDato[];
}): Balance {
  const { presupuesto, adicionales, contratos, asignaciones } = entrada;
  const contratosPorId = new Map(contratos.map((c) => [c.id, c]));

  const capitulos = presupuesto.capitulos.map((c) =>
    fila(
      { tipo: "capitulo", id: c.id, codigo: c.codigo, nombre: c.nombre, presupuestoDirecto: c.subtotal, presupuesto: conIndirectos(c.subtotal, presupuesto) },
      asignaciones.filter((a) => a.capituloId === c.id), contratosPorId,
    ),
  );
  const filasAdicionales = adicionales.map((a) =>
    fila(
      {
        tipo: "adicional", id: a.id, codigo: a.codigo, nombre: a.descripcion, presupuestoDirecto: a.valorDirecto,
        presupuesto: a.aplicaIndirectos ? conIndirectos(a.valorDirecto, presupuesto) : a.valorDirecto, estado: a.estado,
      },
      asignaciones.filter((x) => x.adicionalId === a.id), contratosPorId,
    ),
  );
  const aprobados = filasAdicionales.filter((f) => f.estado === "aprobado");

  const totalCapitulos = sumar("Capítulos del presupuesto", capitulos);
  const totalAdicionalesAprobados = sumar("Adicionales aprobados", aprobados);
  const total = sumar("Total", [...capitulos, ...aprobados]);

  const sinAsignar = contratos
    .map((c) => {
      const asignado = asignaciones.filter((a) => a.contratoId === c.id).reduce((t, a) => t + a.valor, 0n);
      return { contratoId: c.id, contratista: c.contratista, tipo: c.tipo, valor: c.valor, sinAsignar: c.valor - asignado, aprobado: c.aprobado };
    })
    .filter((c) => c.sinAsignar > 0n);

  return {
    capitulos,
    adicionales: filasAdicionales,
    totalCapitulos, totalAdicionalesAprobados, total,
    adicionalesEnTramite: filasAdicionales.filter((f) => f.estado === "identificado").reduce((t, f) => t + f.presupuesto, 0n),
    sinAsignar,
    totalSinAsignar: sinAsignar.filter((c) => c.aprobado).reduce((t, c) => t + c.sinAsignar, 0n),
  };
}
