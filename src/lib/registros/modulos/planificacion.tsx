// Stakeholders, WBS y riesgos (hito 3).

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { BotonEnviar } from "@/components/boton-enviar";
import { claseBoton } from "@/components/ui";
import { numeroParametro, listaParametro, valorParametro } from "@/lib/pmo/parametros";
import { estrategiaStakeholder, ETIQUETA_ESTRATEGIA, leerCortes, CORTES_RIESGO } from "@/lib/pmo/planificacion";
import { nivelDeRiesgo, type NivelRiesgo } from "@/lib/pmo/semaforo";
import type { Definicion, Fila, ContextoLista } from "../tipos";

const txt = (v: unknown) => (v === null || v === undefined ? "—" : String(v));
const recorta = (v: unknown, n = 90) => { const t = txt(v); return t.length > n ? `${t.slice(0, n)}…` : t; };
const NIVEL_ETIQUETA: Record<NivelRiesgo, string> = { critico: "Crítico", alto: "Alto", medio: "Medio", bajo: "Bajo" };
const NIVEL_CLASE: Record<NivelRiesgo, string> = {
  critico: "bg-red-100 text-red-900 border-red-500",
  alto: "bg-orange-100 text-orange-900 border-orange-500",
  medio: "bg-amber-100 text-amber-900 border-amber-500",
  bajo: "bg-leaf-100 text-leaf-800 border-leaf-400",
};

export function cortesRiesgo(ctx: ContextoLista) {
  const c = { proyectoId: ctx.proyecto.id, portafolioId: ctx.proyecto.portafolio_id };
  return {
    critico: numeroParametro(ctx.parametros, "riesgo_critico_min", c, CORTES_RIESGO.critico),
    alto: numeroParametro(ctx.parametros, "riesgo_alto_min", c, CORTES_RIESGO.alto),
    medio: numeroParametro(ctx.parametros, "riesgo_medio_min", c, CORTES_RIESGO.medio),
  };
}

function Insignia({ nivel }: { nivel: NivelRiesgo }) {
  return <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${NIVEL_CLASE[nivel]}`}>{NIVEL_ETIQUETA[nivel]}</span>;
}

// ---- Stakeholders ----------------------------------------------------------------

function MatrizPoderInteres({ filas }: { filas: Fila[] }) {
  const celda = (poder: number, interes: number) => filas.filter((f) => f.poder === poder && f.interes === interes);
  return (
    <div>
      <h2 className="font-display text-xl font-bold text-leaf-700">Matriz poder-interés</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-[560px] border-collapse text-xs" aria-label="Matriz poder-interés">
          <caption className="sr-only">Filas: poder de 5 a 1. Columnas: interés de 1 a 5.</caption>
          <tbody>
            {[5, 4, 3, 2, 1].map((poder) => (
              <tr key={poder}>
                <th scope="row" className="pr-2 text-right font-medium text-leaf-800">Poder {poder}</th>
                {[1, 2, 3, 4, 5].map((interes) => {
                  const lista = celda(poder, interes);
                  const fuerte = poder * interes >= 16;
                  return (
                    <td key={interes} className={`h-14 w-24 border border-soil-border p-1 align-top ${fuerte ? "bg-leaf-100" : "bg-white"}`}>
                      {lista.map((f) => <div key={String(f.id)} className="truncate font-medium text-leaf-900" title={String(f.nombre)}>{String(f.nombre)}</div>)}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr><td />{[1, 2, 3, 4, 5].map((i) => <th key={i} scope="col" className="pt-1 font-medium text-leaf-800">Interés {i}</th>)}</tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const STAKEHOLDERS: Definicion = {
  clave: "stakeholders",
  tabla: "stakeholders",
  titulo: "Stakeholders",
  singular: "stakeholder",
  descripcion: "La estrategia se calcula con poder × interés",
  campos: [
    { nombre: "nombre", etiqueta: "Nombre u organización", tipo: "texto", obligatorio: true, max: 200 },
    { nombre: "rol", etiqueta: "Rol", tipo: "texto", max: 200 },
    { nombre: "poder", etiqueta: "Poder (1 a 5)", tipo: "entero", obligatorio: true, min: 1, max: 5 },
    { nombre: "interes", etiqueta: "Interés (1 a 5)", tipo: "entero", obligatorio: true, min: 1, max: 5 },
    { nombre: "necesidades", etiqueta: "Necesidades y expectativas", tipo: "area", max: 4000 },
    { nombre: "canal", etiqueta: "Canal de comunicación", tipo: "texto", max: 200 },
  ],
  seleccion: "id, nombre, rol, poder, interes, influencia, canal",
  orden: [{ columna: "influencia", asc: false }, { columna: "nombre" }],
  columnas: [
    { etiqueta: "Nombre", valor: (f) => txt(f.nombre) },
    { etiqueta: "Rol", valor: (f) => txt(f.rol) },
    { etiqueta: "Poder", valor: (f) => txt(f.poder) },
    { etiqueta: "Interés", valor: (f) => txt(f.interes) },
    { etiqueta: "Influencia", valor: (f) => txt(f.influencia) },
    {
      etiqueta: "Estrategia",
      valor: (f, ctx) => {
        const cortes = leerCortes(valorParametro(ctx.parametros, "stakeholder_cortes_estrategia", { proyectoId: ctx.proyecto.id, portafolioId: ctx.proyecto.portafolio_id }));
        return ETIQUETA_ESTRATEGIA[estrategiaStakeholder(Number(f.influencia), cortes)];
      },
    },
    { etiqueta: "Canal", valor: (f) => txt(f.canal) },
  ],
  ver: (p) => !p.interventor,
  escribir: (p) => p.gestionar,
  borrar: true,
  extra: (filas) => (filas.length ? <MatrizPoderInteres filas={filas} /> : null),
};

// ---- WBS ------------------------------------------------------------------------------

const comparaCodigos = (a: string, b: string) => {
  const x = a.split(".").map(Number), y = b.split(".").map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? -1) - (y[i] ?? -1);
    if (d !== 0) return d;
  }
  return 0;
};

async function crearPlantillaWbs(proyectoId: string) {
  "use server";
  const { supabase } = await cargarProyecto(proyectoId);
  const { error } = await supabase.rpc("wbs_plantilla", { p_proyecto: proyectoId });
  if (error) console.error("Fallo al crear la plantilla WBS:", error.code, error.message);
  revalidatePath(`/proyectos/${proyectoId}`, "layout");
  redirect(`/proyectos/${proyectoId}/r/wbs?ok=${error ? "no_borrado" : "guardado"}`);
}

const ETIQUETA_ESTADO_WBS = { en_curso: "En curso", completado: "Completado", pendiente: "Pendiente", en_riesgo: "En riesgo", bloqueado: "Bloqueado" };

export const WBS: Definicion = {
  clave: "wbs",
  tabla: "wbs_elementos",
  titulo: "WBS (EDT)",
  singular: "elemento",
  descripcion: "Estructura jerárquica de entregables",
  campos: [
    { nombre: "codigo", etiqueta: "Código (por ejemplo 1.2.1)", tipo: "texto", obligatorio: true, max: 30 },
    { nombre: "nombre", etiqueta: "Entregable o paquete de trabajo", tipo: "texto", obligatorio: true, max: 200 },
    { nombre: "padre_id", etiqueta: "Elemento padre", tipo: "seleccion", opcionesDe: "padres" },
    { nombre: "descripcion", etiqueta: "Descripción", tipo: "area" },
    { nombre: "responsable", etiqueta: "Responsable", tipo: "texto", max: 200 },
    { nombre: "inicio_plan", etiqueta: "Inicio planificado", tipo: "fecha" },
    { nombre: "fin_plan", etiqueta: "Fin planificado", tipo: "fecha" },
    { nombre: "estado", etiqueta: "Estado", tipo: "seleccion", obligatorio: true, porDefecto: "pendiente", opciones: Object.entries(ETIQUETA_ESTADO_WBS).map(([valor, etiqueta]) => ({ valor, etiqueta })) },
  ],
  seleccion: "id, codigo, nombre, responsable, inicio_plan, fin_plan, estado",
  orden: [{ columna: "codigo" }],
  ordenar: (filas) => [...filas].sort((a, b) => comparaCodigos(String(a.codigo), String(b.codigo))),
  columnas: [
    { etiqueta: "Código", valor: (f) => txt(f.codigo) },
    { etiqueta: "Entregable", valor: (f) => <span style={{ paddingLeft: `${(String(f.codigo).split(".").length - 1) * 14}px` }}>{txt(f.nombre)}</span> },
    { etiqueta: "Responsable", valor: (f) => txt(f.responsable) },
    { etiqueta: "Inicio", valor: (f) => txt(f.inicio_plan) },
    { etiqueta: "Fin", valor: (f) => txt(f.fin_plan) },
    { etiqueta: "Estado", valor: (f) => ETIQUETA_ESTADO_WBS[f.estado as keyof typeof ETIQUETA_ESTADO_WBS] ?? txt(f.estado) },
  ],
  ver: () => true,
  escribir: (p) => p.gestionar,
  borrar: true,
  opciones: async (supabase: SupabaseClient, proyectoId: string) => {
    const { data } = await supabase.from("wbs_elementos").select("id, codigo, nombre").eq("proyecto_id", proyectoId);
    const lista = ((data ?? []) as { id: string; codigo: string; nombre: string }[]).sort((a, b) => comparaCodigos(a.codigo, b.codigo));
    return { padres: lista.map((x) => ({ valor: x.id, etiqueta: `${x.codigo} ${x.nombre}` })) };
  },
  validar: async (v, { supabase, proyectoId, registroId }) => {
    // Evita ciclos: subiendo por los padres nunca debe aparecer el propio elemento.
    let actual = v.padre_id as string | null;
    for (let i = 0; actual && i < 60; i++) {
      if (actual === registroId) return "Ese padre crearía un ciclo en la estructura.";
      const { data } = await supabase.from("wbs_elementos").select("padre_id").eq("id", actual).eq("proyecto_id", proyectoId).maybeSingle();
      actual = (data?.padre_id as string | null) ?? null;
    }
    return null;
  },
  extra: (filas, ctx) =>
    filas.length === 0 && ctx.permisos.gestionar ? (
      <form action={crearPlantillaWbs.bind(null, ctx.proyecto.id)} className="rounded-card bg-leaf-50 p-5">
        <p className="mb-3 text-sm text-muted">La WBS está vacía. Puedes empezar con la plantilla estándar del libro (1.1 Gestión, 1.2 Ingeniería y diseño, 1.3 Permisos, 1.4 Adquisiciones, 1.5 Construcción, 1.6 Calidad y SST, 1.7 Entrega y cierre).</p>
        <BotonEnviar className={claseBoton.secundario} textoEnviando="Creando…">Usar la plantilla estándar</BotonEnviar>
      </form>
    ) : null,
};

// ---- Riesgos ----------------------------------------------------------------------------

function MatrizRiesgos({ filas, ctx }: { filas: Fila[]; ctx: ContextoLista }) {
  const cortes = cortesRiesgo(ctx);
  const activos = filas.filter((f) => f.estado === "activo");
  return (
    <div>
      <h2 className="font-display text-xl font-bold text-leaf-700">Matriz de riesgos activos</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-[480px] border-collapse text-xs" aria-label="Matriz de riesgos: probabilidad por impacto">
          <caption className="sr-only">Cantidad de riesgos activos por probabilidad (filas) e impacto (columnas).</caption>
          <tbody>
            {[5, 4, 3, 2, 1].map((p) => (
              <tr key={p}>
                <th scope="row" className="pr-2 text-right font-medium text-leaf-800">Prob. {p}</th>
                {[1, 2, 3, 4, 5].map((i) => {
                  const n = activos.filter((f) => f.probabilidad === p && f.impacto === i);
                  const nivel = nivelDeRiesgo(p * i, cortes);
                  return (
                    <td key={i} className={`h-12 w-16 border border-soil-border text-center align-middle ${NIVEL_CLASE[nivel]}`} title={`${NIVEL_ETIQUETA[nivel]} (score ${p * i})`}>
                      {n.length > 0 ? <span className="font-bold">{n.map((x) => String(x.codigo)).join(", ")}</span> : ""}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr><td />{[1, 2, 3, 4, 5].map((i) => <th key={i} scope="col" className="pt-1 font-medium text-leaf-800">Imp. {i}</th>)}</tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

const ESTRATEGIAS = [["evitar", "Evitar"], ["mitigar", "Mitigar"], ["transferir", "Transferir"], ["aceptar", "Aceptar"]] as const;
const ESTADOS_RIESGO = [["activo", "Activo"], ["materializado", "Materializado"], ["cerrado", "Cerrado"]] as const;

export const RIESGOS: Definicion = {
  clave: "riesgos",
  tabla: "riesgos",
  titulo: "Riesgos",
  singular: "riesgo",
  descripcion: "Score = probabilidad × impacto. Crítico 15–25, Alto 8–14, Medio 4–7, Bajo 1–3",
  campos: [
    { nombre: "categoria", etiqueta: "Categoría", tipo: "seleccion", obligatorio: true, opcionesDe: "categorias" },
    { nombre: "descripcion", etiqueta: "Descripción del riesgo", tipo: "area", obligatorio: true },
    { nombre: "probabilidad", etiqueta: "Probabilidad (1 a 5)", tipo: "entero", obligatorio: true, min: 1, max: 5 },
    { nombre: "impacto", etiqueta: "Impacto (1 a 5)", tipo: "entero", obligatorio: true, min: 1, max: 5 },
    { nombre: "estrategia", etiqueta: "Estrategia de respuesta", tipo: "seleccion", opciones: ESTRATEGIAS.map(([valor, etiqueta]) => ({ valor, etiqueta })) },
    { nombre: "plan_accion", etiqueta: "Plan de acción", tipo: "area" },
    { nombre: "responsable", etiqueta: "Responsable", tipo: "texto", max: 200 },
    { nombre: "estado", etiqueta: "Estado", tipo: "seleccion", obligatorio: true, porDefecto: "activo", opciones: ESTADOS_RIESGO.map(([valor, etiqueta]) => ({ valor, etiqueta })) },
  ],
  seleccion: "id, codigo, categoria, descripcion, probabilidad, impacto, score, estrategia, plan_accion, responsable, estado",
  orden: [{ columna: "score", asc: false }, { columna: "codigo" }],
  columnas: [
    { etiqueta: "Código", valor: (f) => txt(f.codigo) },
    { etiqueta: "Categoría", valor: (f) => txt(f.categoria) },
    { etiqueta: "Descripción", valor: (f) => recorta(f.descripcion) },
    { etiqueta: "P × I", valor: (f) => `${f.probabilidad} × ${f.impacto} = ${f.score}` },
    { etiqueta: "Nivel", valor: (f, ctx) => <Insignia nivel={nivelDeRiesgo(Number(f.score), cortesRiesgo(ctx))} /> },
    { etiqueta: "Estrategia", valor: (f) => ESTRATEGIAS.find(([v]) => v === f.estrategia)?.[1] ?? "—" },
    { etiqueta: "Responsable", valor: (f) => txt(f.responsable) },
    { etiqueta: "Estado", valor: (f) => ESTADOS_RIESGO.find(([v]) => v === f.estado)?.[1] ?? txt(f.estado) },
  ],
  ver: (p) => !p.interventor,
  escribir: (p) => p.gestionar,
  borrar: true,
  opciones: async (supabase: SupabaseClient, proyectoId: string) => {
    const [{ data: pars }, { data: proy }] = await Promise.all([
      supabase.from("parametros").select("ambito, ambito_id, clave, valor"),
      supabase.from("proyectos").select("portafolio_id").eq("id", proyectoId).maybeSingle(),
    ]);
    const cats = listaParametro((pars ?? []) as never, "categorias_riesgo", { proyectoId, portafolioId: proy?.portafolio_id ?? null });
    return { categorias: cats.map((c) => ({ valor: c, etiqueta: c })) };
  },
  extra: (filas, ctx) => (filas.length ? <MatrizRiesgos filas={filas} ctx={ctx} /> : null),
};
