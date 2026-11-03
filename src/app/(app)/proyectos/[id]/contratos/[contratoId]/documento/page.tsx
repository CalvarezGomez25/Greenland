import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { ES_UUID } from "@/lib/formato";
import { construirCampos } from "@/lib/documentos/campos";
import { cargarDatosDocumento } from "@/lib/documentos/datos";
import { INCORPORADAS } from "@/lib/documentos/incorporadas";
import { Aviso, Campo, Titulo, claseBoton } from "@/components/ui";
import { ETIQUETA_TIPO_MODIFICACION } from "@/lib/contratos/vigilancia";

type Plantilla = { id: string; nombre: string; ambito: string; campos: string[]; incorporada: boolean };

async function Contenido({ params, searchParams }: { params: Promise<{ id: string; contratoId: string }>; searchParams: Promise<{ mod?: string; plantilla?: string }> }) {
  const { id, contratoId } = await params;
  const { mod, plantilla: elegida } = await searchParams;
  if (!ES_UUID.test(contratoId)) notFound();
  const { supabase, permisos } = await cargarProyecto(id);
  const volver = `/proyectos/${id}/contratos/${contratoId}`;
  if (!permisos.gestionar) redirect(volver);
  const modId = mod && ES_UUID.test(mod) ? mod : null;
  const datos = await cargarDatosDocumento(supabase, id, contratoId, modId);
  if (!datos) notFound();
  const modificacion = modId ? datos.modificaciones.find((m) => m.id === modId) : undefined;
  if (modId && !modificacion) notFound();
  const ambito = modificacion ? "modificacion" : "contrato";

  const { data: ps } = await supabase.from("plantillas_documento").select("id, nombre, ambito, campos").eq("activa", true).eq("ambito", ambito).order("nombre");
  const plantillas: Plantilla[] = [
    ...((ps ?? []) as { id: string; nombre: string; ambito: string; campos: string[] }[]).map((p) => ({ ...p, incorporada: false })),
    ...INCORPORADAS.filter((p) => p.ambito === ambito).map((p) => ({ id: p.id, nombre: p.nombre, ambito: p.ambito, campos: p.campos, incorporada: true })),
  ];
  const sel = plantillas.find((p) => p.id === elegida);
  const resueltos = construirCampos(datos);
  const faltan = sel ? sel.campos.filter((c) => !resueltos[c]) : [];
  const base = `${volver}/documento${modId ? `?mod=${modId}` : ""}`;

  return (
    <>
      <Link href={volver} className="text-sm font-medium text-leaf-600 hover:underline">← Volver al contrato</Link>
      <div className="mt-4"><Titulo>Generar documento</Titulo></div>
      <p className="mt-3 max-w-3xl text-sm text-muted">
        {datos.proyecto.nombre} · {datos.contrato.contratista}{modificacion ? ` · ${ETIQUETA_TIPO_MODIFICACION[modificacion.tipo]} N.° ${modificacion.numero}` : ""}. Se llena el archivo Word con los datos de PMO360; lo que aún no se guarda
        (actividades, forma de pago, cédulas…) lo escribes aquí o queda como «[POR COMPLETAR]». Los textos jurídicos viven en las plantillas que sube el administrador, no en la plataforma.
      </p>
      {plantillas.length === 0 ? (
        <div className="mt-6"><Aviso>No hay plantillas activas para este tipo de documento.</Aviso></div>
      ) : (
        <ul className="mt-6 grid gap-2 sm:grid-cols-2">
          {plantillas.map((p) => (
            <li key={p.id}>
              <Link href={`${base}${modId ? "&" : "?"}plantilla=${encodeURIComponent(p.id)}`} className={`block rounded-card border p-4 transition hover:-translate-y-0.5 hover:shadow-card ${sel?.id === p.id ? "border-leaf-600 bg-leaf-50" : "border-soil-border"}`}>
                <span className="font-medium text-leaf-800">{p.nombre}</span>
                <span className="mt-1 block text-xs text-muted">{p.incorporada ? "Plantilla incorporada de ejemplo (requiere revisión jurídica)" : "Plantilla de la empresa"} · {p.campos.length} campos</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {sel && (
        <form method="post" action={`${volver}/documento/descargar`} className="mt-8 flex max-w-3xl flex-col gap-4 rounded-card bg-leaf-50 p-5">
          <input type="hidden" name="plantilla" value={sel.id} />
          {modId && <input type="hidden" name="mod" value={modId} />}
          <p className="text-sm"><strong>{sel.nombre}.</strong> {sel.campos.length - faltan.length} de {sel.campos.length} campos salen de PMO360.{faltan.length > 0 ? " Completa los que faltan (o déjalos vacíos para que queden como «[POR COMPLETAR]» en el documento):" : " No falta ninguno."}</p>
          {faltan.map((c) => <Campo key={c} etiqueta={c.replaceAll("_", " ").toLowerCase().replace(/^./, (x) => x.toUpperCase())} name={`c_${c}`} maxLength={1500} />)}
          <div><button type="submit" className={claseBoton.primario}>Generar y descargar (.docx)</button></div>
          <p className="text-xs text-muted">Revisa el documento antes de usarlo: es un borrador generado con los datos que hay hoy en la plataforma.</p>
        </form>
      )}
    </>
  );
}

export default function PaginaDocumento({ params, searchParams }: PageProps<"/proyectos/[id]/contratos/[contratoId]/documento">) {
  return <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><Contenido params={params} searchParams={searchParams} /></Suspense>;
}
