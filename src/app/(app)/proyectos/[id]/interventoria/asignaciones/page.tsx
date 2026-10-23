import { Suspense } from "react";
import Link from "next/link";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { formatearFecha } from "@/lib/formato";
import { ALCANCES, SUBROLES, etiqueta } from "@/lib/interventoria";
import { Aviso, Titulo, claseBoton } from "@/components/ui";
import { BotonEnviar } from "@/components/boton-enviar";
import { AvisoResultado } from "@/components/aviso-resultado";
import { FormularioRegistro } from "../../r/formulario-registro";
import { cargarOpciones } from "../datos";
import { asignarUsuario, guardarAlcance, quitarAsignacion } from "../acciones";
import { FormularioAlcance } from "../formularios";
import type { CampoDef } from "@/lib/registros/tipos";

type Al = { id: string; contrato_interventoria_id: string | null; contrato_vigilado_id: string | null; alcances: string[]; fecha_inicio: string | null; fecha_fin: string | null };
type Us = { alcance_id: string; usuario_id: string; subrol: string };

async function Contenido({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { id } = await params;
  const { ok, error } = await searchParams;
  const { supabase, proyecto, permisos } = await cargarProyecto(id);
  const [o, { data: als }, { data: us }, { data: per }, { data: mi }] = await Promise.all([
    cargarOpciones(supabase, id, proyecto.portafolio_id),
    supabase.from("interventoria_alcances").select("id, contrato_interventoria_id, contrato_vigilado_id, alcances, fecha_inicio, fecha_fin").eq("proyecto_id", id).order("creado_en"),
    supabase.from("interventoria_usuarios").select("alcance_id, usuario_id, subrol"),
    supabase.from("perfiles").select("id, nombre, correo"),
    permisos.gestionar ? supabase.from("miembros_proyecto").select("usuario_id").eq("proyecto_id", id).eq("rol", "interventoria") : Promise.resolve({ data: [] }),
  ]);
  const alcances = (als ?? []) as Al[];
  const usuarios = (us ?? []) as Us[];
  const nombres = new Map(((per ?? []) as { id: string; nombre: string; correo: string | null }[]).map((p) => [p.id, p.nombre]));
  const nomContrato = new Map([...o.todosContratos].map((c) => [c.valor, c.etiqueta]));
  const interventores = ((mi ?? []) as { usuario_id: string }[]).map((m) => ({ valor: m.usuario_id, etiqueta: nombres.get(m.usuario_id) ?? "—" }));
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const campos: CampoDef[] = [
    { nombre: "usuario_id", etiqueta: "Persona (con rol Interventoría en el proyecto)", tipo: "seleccion", obligatorio: true, opcionesDe: "usuarios" },
    { nombre: "subrol", etiqueta: "Sub-rol", tipo: "seleccion", obligatorio: true, opciones: SUBROLES.map(([valor, etiqueta]) => ({ valor, etiqueta })) },
  ];

  return (
    <>
      <Link href={`/proyectos/${id}/interventoria`} className="text-sm font-medium text-leaf-600 hover:underline">← Interventoría</Link>
      <div className="mt-4"><Titulo>Asignación de interventoría</Titulo></div>
      <p className="mt-3 max-w-3xl text-sm text-muted">Define qué ve cada interventor. Antes de asignar, el administrador debe agregar a la persona al equipo del proyecto con el rol “Interventoría”. {permisos.gestionar ? "" : "Solo el gerente o el administrador cambian las asignaciones."}</p>
      <div className="mt-4 flex flex-col gap-2"><AvisoResultado ok={ok} />{error && <Aviso>{error.slice(0, 400)}</Aviso>}</div>

      {alcances.length === 0 ? <p className="mt-6 rounded-card bg-leaf-50 p-6 text-sm text-muted">Aún no hay asignaciones.</p> : (
        <ul className="mt-6 flex flex-col gap-4">
          {alcances.map((a) => {
            const vigente = (!a.fecha_inicio || a.fecha_inicio <= hoy) && (!a.fecha_fin || a.fecha_fin >= hoy);
            const propios = usuarios.filter((u) => u.alcance_id === a.id);
            return (
              <li key={a.id} className="rounded-card border border-soil-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-lg font-bold text-leaf-700">{a.contrato_vigilado_id ? `Vigila: ${nomContrato.get(a.contrato_vigilado_id) ?? "—"}` : "Sin contrato de obra (diseños y asesoría)"}</p>
                    <p className="text-sm text-muted">Contrato de interventoría: {a.contrato_interventoria_id ? nomContrato.get(a.contrato_interventoria_id) ?? "—" : "no registrado"} · Alcances: {a.alcances.map((x) => etiqueta(ALCANCES, x)).join(", ")}</p>
                    <p className="text-sm text-muted">Vigencia: {a.fecha_inicio ? formatearFecha(a.fecha_inicio) : "sin inicio"} a {a.fecha_fin ? formatearFecha(a.fecha_fin) : "sin fin"} · {vigente ? "vigente" : "NO vigente"}</p>
                  </div>
                  {(permisos.admin || permisos.director) && <form action={quitarAsignacion.bind(null, id, a.id, null)}><BotonEnviar className={claseBoton.peligro} textoEnviando="Quitando…">Quitar asignación</BotonEnviar></form>}
                </div>
                <ul className="mt-3 divide-y divide-soil-border text-sm">
                  {propios.length === 0 && <li className="py-2 text-muted">Sin personas asignadas.</li>}
                  {propios.map((u) => (
                    <li key={u.usuario_id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span>{nombres.get(u.usuario_id) ?? "—"} · <strong>{etiqueta(SUBROLES, u.subrol)}</strong></span>
                      {permisos.gestionar && <form action={quitarAsignacion.bind(null, id, a.id, u.usuario_id)}><BotonEnviar className="text-sm font-medium text-danger underline" textoEnviando="…">Quitar</BotonEnviar></form>}</li>
                  ))}
                </ul>
                {permisos.gestionar && (
                  <div className="mt-3 rounded-[10px] bg-leaf-50 p-4"><p className="mb-2 text-sm font-medium text-leaf-800">Agregar una persona</p>
                    <FormularioRegistro accion={asignarUsuario.bind(null, id, a.id)} campos={campos} opciones={{ usuarios: interventores }} iniciales={{}} editando={false} volverA={`/proyectos/${id}/interventoria/asignaciones`} /></div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {permisos.gestionar && (
        <section className="mt-8 rounded-card bg-leaf-50 p-5"><h2 className="mb-3 font-display text-xl font-bold text-leaf-700">Nueva asignación</h2>
          <FormularioAlcance accion={guardarAlcance.bind(null, id)} interventoria={o.contratosInterventoria} obra={o.contratosObra} /></section>
      )}
    </>
  );
}

export default function PaginaAsignaciones({ params, searchParams }: PageProps<"/proyectos/[id]/interventoria/asignaciones">) {
  return <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><Contenido params={params} searchParams={searchParams} /></Suspense>;
}
