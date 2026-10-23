import { Suspense } from "react";
import Link from "next/link";
import { formatearFechaHora } from "@/lib/formato";
import { describirCambio, type CambioFila } from "@/lib/presupuesto/cambios";
import { cargarContexto } from "@/lib/presupuesto/contexto";
import { Titulo } from "@/components/ui";

const LIMITE = 200;

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, proyecto } = await cargarContexto(id, "auditoria");

  const { data, error } = await supabase
    .from("cambios_presupuesto")
    .select("id, fecha, usuario_nombre, entidad, operacion, registro_id, antes, despues, motivo")
    .eq("proyecto_id", id)
    .order("id", { ascending: false })
    .limit(LIMITE);
  if (error) throw new Error(error.message);
  const cambios = (data ?? []) as CambioFila[];

  return (
    <>
      <Link href={`/proyectos/${id}/presupuesto`} className="text-sm font-medium text-leaf-600 hover:underline">
        ← Volver al presupuesto
      </Link>
      <div className="mt-4">
        <Titulo>Registro de cambios</Titulo>
      </div>
      <p className="mt-3 text-sm text-muted">
        {proyecto.nombre} · cada cambio al presupuesto queda aquí con quién lo hizo, cuándo y qué valores cambiaron. Nadie puede
        editar ni borrar este registro desde la plataforma. Horas de Colombia.
      </p>

      {cambios.length === 0 ? (
        <p className="mt-6 rounded-card bg-leaf-50 p-6 text-center text-sm text-muted">Todavía no hay cambios registrados.</p>
      ) : (
        <>
          {cambios.length === LIMITE && <p className="mt-4 text-sm text-muted">Se muestran los últimos {LIMITE} cambios.</p>}
          <ol className="mt-6 flex flex-col gap-3">
            {cambios.map((c) => {
              const d = describirCambio(c);
              return (
                <li key={c.id} className="rounded-card border border-soil-border p-4">
                  <p className="text-xs text-muted">
                    {formatearFechaHora(c.fecha)} · {c.usuario_nombre ?? "Sistema"}
                  </p>
                  <p className="mt-1 font-medium text-leaf-900">{d.titulo}</p>
                  {d.detalles.length > 0 && (
                    <ul className="mt-1 list-disc pl-5 text-sm">
                      {d.detalles.map((x, i) => (
                        <li key={i}>{x}</li>
                      ))}
                    </ul>
                  )}
                  {c.motivo && (
                    <p className="mt-2 text-sm">
                      <span className="font-medium text-leaf-800">Motivo:</span> {c.motivo}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        </>
      )}
    </>
  );
}

export default function PaginaCambios({ params }: PageProps<"/proyectos/[id]/presupuesto/cambios">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}>
      <Contenido params={params} />
    </Suspense>
  );
}
