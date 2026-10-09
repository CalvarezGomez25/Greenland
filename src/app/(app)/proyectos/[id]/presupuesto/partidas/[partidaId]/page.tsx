import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ES_UUID } from "@/lib/formato";
import { cargarContexto } from "@/lib/presupuesto/contexto";
import { desdeJson, ESCALA, formatearDecimal } from "@/lib/presupuesto/dinero";
import { Titulo } from "@/components/ui";
import { borrarPartida, guardarPartida } from "../../acciones";
import { FormularioBorrar } from "../../_formularios/formulario-borrar";
import { FormularioPartida } from "../../_formularios/formulario-partida";

async function Contenido({ params }: { params: Promise<{ id: string; partidaId: string }> }) {
  const { id, partidaId } = await params;
  if (!ES_UUID.test(partidaId)) notFound();
  const { supabase, proyecto } = await cargarContexto(id, "editar");

  const { data: p } = await supabase
    .from("apu_partidas")
    .select("id, capitulo_id, codigo, descripcion, unidad, cantidad, precio_unitario")
    .eq("id", partidaId)
    .eq("proyecto_id", id)
    .maybeSingle();
  if (!p) notFound();

  const [{ data: cap }, { data: caps }] = await Promise.all([
    supabase.from("capitulos").select("nombre").eq("id", p.capitulo_id as string).maybeSingle(),
    supabase.from("capitulos").select("nombre").eq("proyecto_id", id).order("orden"),
  ]);

  const precio = desdeJson(p.precio_unitario as number | string, ESCALA.precio);
  const inicial = {
    capitulo: (cap?.nombre as string) ?? "",
    codigo: p.codigo as string,
    unidad: p.unidad as string,
    descripcion: p.descripcion as string,
    cantidad: formatearDecimal(desdeJson(p.cantidad as number | string, ESCALA.cantidad), ESCALA.cantidad),
    precio: formatearDecimal(precio, ESCALA.precio, precio % 100n === 0n ? 0 : 2),
  };

  return (
    <>
      <Link href={`/proyectos/${id}/presupuesto`} className="text-sm font-medium text-leaf-600 hover:underline">
        ← Volver al presupuesto
      </Link>
      <div className="mt-4">
        <Titulo>Editar partida</Titulo>
      </div>
      <p className="mt-3 text-sm text-muted">
        {proyecto.nombre} · {inicial.codigo}
      </p>
      <div className="mt-6">
        <FormularioPartida
          accion={guardarPartida.bind(null, id, partidaId)}
          capitulos={((caps ?? []) as { nombre: string }[]).map((c) => c.nombre)}
          inicial={inicial}
          textoBoton="Guardar cambios"
          volver={`/proyectos/${id}/presupuesto`}
        />
      </div>

      <section className="mt-12 max-w-xl rounded-card border border-danger/30 bg-red-50 p-5" aria-labelledby="borrar">
        <h2 id="borrar" className="font-display text-xl font-bold text-danger">
          Borrar esta partida
        </h2>
        <div className="mt-3">
          <FormularioBorrar
            accion={borrarPartida.bind(null, id, partidaId)}
            textoBoton="Borrar partida"
            ayuda="La partida se elimina del presupuesto. El cambio queda en el registro, con tu nombre y el motivo."
          />
        </div>
      </section>
    </>
  );
}

export default function PaginaEditarPartida({ params }: PageProps<"/proyectos/[id]/presupuesto/partidas/[partidaId]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}>
      <Contenido params={params} />
    </Suspense>
  );
}
