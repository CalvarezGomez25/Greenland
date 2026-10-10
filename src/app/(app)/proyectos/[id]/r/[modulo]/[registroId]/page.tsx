import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { ES_UUID } from "@/lib/formato";
import { obtenerDefinicion } from "@/lib/registros/definiciones";
import { Titulo } from "@/components/ui";
import { borrarRegistro, guardarRegistro } from "../../acciones";
import { FormularioRegistro } from "../../formulario-registro";
import { BotonBorrar } from "../../boton-borrar";

async function Contenido({ params }: { params: Promise<{ id: string; modulo: string; registroId: string }> }) {
  const { id, modulo, registroId } = await params;
  const def = obtenerDefinicion(modulo);
  if (!def) notFound();
  const nuevo = registroId === "nuevo";
  if (!nuevo && !ES_UUID.test(registroId)) notFound();
  const { supabase, permisos } = await cargarProyecto(id);
  if (!def.escribir(permisos)) redirect(`/proyectos/${id}/${def.regreso ?? `r/${modulo}`}`);

  const iniciales: Record<string, string> = {};
  if (!nuevo) {
    const { data } = await supabase.from(def.tabla).select("*").eq("id", registroId).eq("proyecto_id", id).maybeSingle();
    if (!data) notFound();
    for (const c of def.campos) {
      const x = (data as Record<string, unknown>)[c.nombre];
      iniciales[c.nombre] = c.tipo === "casilla" ? (x ? "on" : "") : x === null || x === undefined ? "" : String(x);
    }
  }
  const opciones = def.opciones ? await def.opciones(supabase, id) : {};
  const volverA = `/proyectos/${id}/${def.regreso ?? `r/${modulo}`}`;

  return (
    <>
      <Link href={volverA} className="text-sm font-medium text-leaf-600 hover:underline">← Volver</Link>
      <div className="mt-4"><Titulo>{nuevo ? `Agregar ${def.singular}` : `Editar ${def.singular}`}</Titulo></div>
      <div className="mt-6">
        <FormularioRegistro
          accion={guardarRegistro.bind(null, modulo, id, nuevo ? null : registroId)}
          campos={def.campos}
          opciones={opciones}
          iniciales={iniciales}
          editando={!nuevo}
          volverA={volverA}
        />
      </div>
      {!nuevo && def.borrar && (
        <div className="mt-8 border-t border-soil-border pt-6">
          <BotonBorrar accion={borrarRegistro.bind(null, modulo, id, registroId)} texto={`este ${def.singular}`} />
        </div>
      )}
    </>
  );
}

export default function PaginaRegistro({ params }: PageProps<"/proyectos/[id]/r/[modulo]/[registroId]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}>
      <Contenido params={params} />
    </Suspense>
  );
}
