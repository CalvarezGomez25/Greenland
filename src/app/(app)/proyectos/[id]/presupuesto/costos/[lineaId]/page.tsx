import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ES_UUID } from "@/lib/formato";
import { cargarContexto } from "@/lib/presupuesto/contexto";
import { desdeJson, ESCALA, formatearDecimal } from "@/lib/presupuesto/dinero";
import { Titulo } from "@/components/ui";
import { borrarCostoAdicional, guardarCostoAdicional } from "../../acciones";
import { FormularioBorrar } from "../../_formularios/formulario-borrar";
import { FormularioCosto } from "../../_formularios/formulario-costo";

type Linea = { id: string; nombre: string; base: string; linea_base_id: string | null; porcentaje: number | string };

async function Contenido({ params }: { params: Promise<{ id: string; lineaId: string }> }) {
  const { id, lineaId } = await params;
  if (!ES_UUID.test(lineaId)) notFound();
  const { supabase, proyecto } = await cargarContexto(id, "editar");

  const { data } = await supabase
    .from("costos_adicionales")
    .select("id, nombre, base, linea_base_id, porcentaje")
    .eq("proyecto_id", id)
    .order("orden");
  const lineas = (data ?? []) as Linea[];
  const linea = lineas.find((l) => l.id === lineaId);
  if (!linea) notFound();

  // Sobre qué otras líneas puede apoyarse: las que se calculan sobre el costo directo, salvo ella misma;
  // y ninguna si otras líneas ya dependen de esta (solo se permite un nivel).
  const tieneDependientes = lineas.some((l) => l.linea_base_id === lineaId);
  const opcionesBase = tieneDependientes ? [] : lineas.filter((l) => l.id !== lineaId && l.base === "costo_directo");

  const inicial = {
    nombre: linea.nombre,
    base: linea.base === "linea" && linea.linea_base_id ? linea.linea_base_id : "costo_directo",
    porcentaje: formatearDecimal(desdeJson(linea.porcentaje, ESCALA.porcentaje), ESCALA.porcentaje),
  };

  return (
    <>
      <Link href={`/proyectos/${id}/presupuesto/costos`} className="text-sm font-medium text-leaf-600 hover:underline">
        ← Volver a costos adicionales
      </Link>
      <div className="mt-4">
        <Titulo>Editar costo adicional</Titulo>
      </div>
      <p className="mt-3 text-sm text-muted">
        {proyecto.nombre} · {linea.nombre}
      </p>
      <div className="mt-6">
        <FormularioCosto
          accion={guardarCostoAdicional.bind(null, id, lineaId)}
          opcionesBase={opcionesBase}
          inicial={inicial}
          textoBoton="Guardar cambios"
          volver={`/proyectos/${id}/presupuesto/costos`}
        />
      </div>

      <section className="mt-12 max-w-xl rounded-card border border-danger/30 bg-red-50 p-5" aria-labelledby="borrar">
        <h2 id="borrar" className="font-display text-xl font-bold text-danger">
          Borrar este concepto
        </h2>
        <div className="mt-3">
          <FormularioBorrar
            accion={borrarCostoAdicional.bind(null, id, lineaId)}
            textoBoton="Borrar concepto"
            ayuda={
              tieneDependientes
                ? "Otros conceptos se calculan sobre este; primero bórralos o cámbialos."
                : "El concepto se elimina del cálculo del costo total. El cambio queda en el registro."
            }
          />
        </div>
      </section>
    </>
  );
}

export default function PaginaEditarCosto({ params }: PageProps<"/proyectos/[id]/presupuesto/costos/[lineaId]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}>
      <Contenido params={params} />
    </Suspense>
  );
}
