import { NextResponse } from "next/server";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { ES_UUID } from "@/lib/formato";
import { construirCampos } from "@/lib/documentos/campos";
import { combinarDocx } from "@/lib/documentos/combinar";
import { cargarDatosDocumento, nombreArchivoSeguro } from "@/lib/documentos/datos";
import { INCORPORADAS, generarPlantillaIncorporada } from "@/lib/documentos/incorporadas";

// Genera el documento Word. Solo lee (no cambia datos); exige poder gestionar el contrato.
export async function POST(request: Request, { params }: { params: Promise<{ id: string; contratoId: string }> }) {
  const { id, contratoId } = await params;
  if (!ES_UUID.test(contratoId)) return new NextResponse("Contrato no válido.", { status: 404 });
  const { supabase, permisos } = await cargarProyecto(id);
  if (!permisos.gestionar) return new NextResponse("No tienes permiso para generar documentos de este contrato.", { status: 403 });
  const form = await request.formData();
  const plantilla = String(form.get("plantilla") ?? "");
  const modRaw = String(form.get("mod") ?? "");
  const modId = modRaw && ES_UUID.test(modRaw) ? modRaw : null;
  const datos = await cargarDatosDocumento(supabase, id, contratoId, modId);
  if (!datos) return new NextResponse("Contrato no encontrado.", { status: 404 });
  const modificacion = modId ? datos.modificaciones.find((m) => m.id === modId) : undefined;
  if (modId && !modificacion) return new NextResponse("Modificación no encontrada.", { status: 404 });

  let archivo: Buffer;
  let nombre: string;
  const incorporada = INCORPORADAS.find((p) => p.id === plantilla);
  if (incorporada) {
    if (incorporada.ambito !== (modificacion ? "modificacion" : "contrato")) return new NextResponse("La plantilla no corresponde a este documento.", { status: 400 });
    archivo = await generarPlantillaIncorporada(incorporada);
    nombre = incorporada.nombre;
  } else {
    if (!ES_UUID.test(plantilla)) return new NextResponse("Plantilla no válida.", { status: 400 });
    const { data: p } = await supabase.from("plantillas_documento").select("nombre, ambito, archivo, activa").eq("id", plantilla).maybeSingle();
    if (!p || !p.activa || p.ambito !== (modificacion ? "modificacion" : "contrato")) return new NextResponse("Plantilla no disponible.", { status: 404 });
    const { data: blob, error } = await supabase.storage.from("plantillas").download(p.archivo);
    if (error || !blob) return new NextResponse("No se pudo leer el archivo de la plantilla.", { status: 502 });
    archivo = Buffer.from(await blob.arrayBuffer());
    nombre = p.nombre;
  }

  // Lo escrito a mano manda sobre lo que calcula la plataforma solo si no está vacío.
  const valores = construirCampos(datos);
  for (const [k, v] of form.entries()) if (k.startsWith("c_") && typeof v === "string" && v.trim()) valores[k.slice(2).toUpperCase()] = v.trim().slice(0, 1500);

  let combinado;
  try { combinado = await combinarDocx(archivo, valores); }
  catch (e) { return new NextResponse(e instanceof Error ? e.message : "No se pudo generar el documento.", { status: 422 }); }
  const salida = `${nombreArchivoSeguro(nombre)}_${nombreArchivoSeguro(datos.contrato.contratista)}_${datos.hoy}.docx`;
  return new NextResponse(new Uint8Array(combinado.archivo), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${salida}"`,
      "Cache-Control": "no-store",
      "X-Campos-Por-Completar": String(combinado.faltantes.length),
    },
  });
}
