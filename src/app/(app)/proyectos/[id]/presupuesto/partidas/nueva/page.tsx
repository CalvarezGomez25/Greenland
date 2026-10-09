import { Suspense } from "react";
import Link from "next/link";
import { cargarContexto } from "@/lib/presupuesto/contexto";
import { Titulo } from "@/components/ui";
import { guardarPartida } from "../../acciones";
import { FormularioPartida } from "../../_formularios/formulario-partida";

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, proyecto } = await cargarContexto(id, "editar");
  const { data } = await supabase.from("capitulos").select("nombre").eq("proyecto_id", id).order("orden");
  const capitulos = ((data ?? []) as { nombre: string }[]).map((c) => c.nombre);

  return (
    <>
      <Link href={`/proyectos/${id}/presupuesto`} className="text-sm font-medium text-leaf-600 hover:underline">
        ← Volver al presupuesto
      </Link>
      <div className="mt-4">
        <Titulo>Agregar partida</Titulo>
      </div>
      <p className="mt-3 text-sm text-muted">{proyecto.nombre}</p>
      <div className="mt-6">
        <FormularioPartida
          accion={guardarPartida.bind(null, id, null)}
          capitulos={capitulos}
          textoBoton="Agregar partida"
          volver={`/proyectos/${id}/presupuesto`}
        />
      </div>
    </>
  );
}

export default function PaginaNuevaPartida({ params }: PageProps<"/proyectos/[id]/presupuesto/partidas/nueva">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}>
      <Contenido params={params} />
    </Suspense>
  );
}
