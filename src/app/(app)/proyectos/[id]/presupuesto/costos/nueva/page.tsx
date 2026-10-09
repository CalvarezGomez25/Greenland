import { Suspense } from "react";
import Link from "next/link";
import { cargarContexto } from "@/lib/presupuesto/contexto";
import { Titulo } from "@/components/ui";
import { guardarCostoAdicional } from "../../acciones";
import { FormularioCosto } from "../../_formularios/formulario-costo";

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, proyecto } = await cargarContexto(id, "editar");
  const { data } = await supabase.from("costos_adicionales").select("id, nombre, base").eq("proyecto_id", id).order("orden");
  // solo se puede calcular sobre líneas que a su vez se calculan sobre el costo directo
  const opcionesBase = ((data ?? []) as { id: string; nombre: string; base: string }[]).filter((l) => l.base === "costo_directo");

  return (
    <>
      <Link href={`/proyectos/${id}/presupuesto/costos`} className="text-sm font-medium text-leaf-600 hover:underline">
        ← Volver a costos adicionales
      </Link>
      <div className="mt-4">
        <Titulo>Agregar costo adicional</Titulo>
      </div>
      <p className="mt-3 text-sm text-muted">{proyecto.nombre}</p>
      <div className="mt-6">
        <FormularioCosto
          accion={guardarCostoAdicional.bind(null, id, null)}
          opcionesBase={opcionesBase}
          textoBoton="Agregar concepto"
          volver={`/proyectos/${id}/presupuesto/costos`}
        />
      </div>
    </>
  );
}

export default function PaginaNuevoCosto({ params }: PageProps<"/proyectos/[id]/presupuesto/costos/nueva">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}>
      <Contenido params={params} />
    </Suspense>
  );
}
