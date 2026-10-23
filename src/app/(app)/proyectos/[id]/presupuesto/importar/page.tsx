import { Suspense } from "react";
import Link from "next/link";
import { cargarContexto } from "@/lib/presupuesto/contexto";
import { cargarDatosPresupuesto } from "@/lib/presupuesto/datos";
import { calcularPresupuesto } from "@/lib/presupuesto/calculos";
import { formatearPesos } from "@/lib/presupuesto/dinero";
import { Titulo } from "@/components/ui";
import { importarCsv } from "../acciones";
import { ImportarCsv } from "../_formularios/importar-csv";

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, proyecto } = await cargarContexto(id, "editar");
  const datos = await cargarDatosPresupuesto(supabase, id);
  const actual = calcularPresupuesto({ ...datos, lineas: [] });

  return (
    <>
      <Link href={`/proyectos/${id}/presupuesto`} className="text-sm font-medium text-leaf-600 hover:underline">
        ← Volver al presupuesto
      </Link>
      <div className="mt-4">
        <Titulo>Importar presupuesto</Titulo>
      </div>
      <p className="mt-3 text-sm text-muted">{proyecto.nombre}</p>

      <div className="mt-6 max-w-2xl rounded-card bg-leaf-50 p-5 text-sm">
        <h2 className="font-display text-lg font-bold text-leaf-700">Cómo debe ser el archivo</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Seis columnas, en este orden: <strong>capítulo, código, descripción, unidad, cantidad, precio unitario</strong>. La
            primera fila puede ser el encabezado.
          </li>
          <li>Separador: punto y coma (;), coma (,) o tabulador.</li>
          <li>
            Números en formato colombiano: punto para los miles y coma para los decimales (<strong>1.234,56</strong>). Un valor
            como 1234.56 se rechaza para evitar errores de lectura.
          </li>
          <li>Máximo 5.000 partidas y 2 MB. Las partidas de un mismo capítulo se agrupan solas, aunque estén separadas.</li>
          <li>Si el archivo tiene algún error no se importa nada: verás la lista de errores para corregirlos.</li>
        </ul>
        <p className="mt-3">
          <a href="/plantilla-presupuesto.csv" download className="font-medium text-leaf-600 underline">
            Descargar un archivo de ejemplo
          </a>{" "}
          (con datos ficticios).
        </p>
      </div>

      <div className="mt-8">
        <ImportarCsv
          accion={importarCsv.bind(null, id)}
          actuales={{ partidas: datos.partidas.length, costoDirecto: formatearPesos(actual.costoDirecto) }}
        />
      </div>
    </>
  );
}

export default function PaginaImportar({ params }: PageProps<"/proyectos/[id]/presupuesto/importar">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}>
      <Contenido params={params} />
    </Suspense>
  );
}
