// Informe gerencial semanal por correo. Lo llama el cron de Vercel (vercel.json) los lunes a las 12:30 UTC = 7:30 a. m. en
// Colombia (sin horario de verano), con "Authorization: Bearer CRON_SECRET". Genera el PDF y el Excel de una página de cada
// proyecto activo y los envía adjuntos, con un resumen en el cuerpo, a cada persona SOLO de los proyectos que le corresponden.
import { enviarCorreo, urlBase, type Adjunto } from "@/lib/alertas/correo";
import { iniciarTarea, json } from "@/lib/alertas/cron";
import { cargarInformes } from "@/lib/informe/datos";
import { informeAPdf } from "@/lib/informe/pdf";
import { informeAExcel } from "@/lib/informe/excel";
import { componerInformeSemanal } from "@/lib/informe/correo";
import { repartirInformes, type MiembroEnvio, type PerfilEnvio } from "@/lib/informe/destinatarios";
import { nombreArchivo } from "@/lib/exportar/respuesta";
import { hoyColombia } from "@/lib/pmo/cargar";

export const maxDuration = 60; // Vercel Hobby permite hasta 60 s

const TIPO_PDF = "application/pdf";
const TIPO_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function GET(req: Request) {
  const tarea = await iniciarTarea(req);
  if ("respuesta" in tarea) return tarea.respuesta;
  const { supabase, proveedor, usuarioAlertas } = tarea;

  try {
    const { data: par } = await supabase.from("parametros").select("valor").eq("ambito", "global").eq("clave", "informe_semanal_activo").maybeSingle();
    if (par?.valor === "no") return json({ omitido: "El informe semanal está desactivado en Parámetros." });

    const informes = await cargarInformes(supabase);
    if (!informes) return json({ error: "No se pudieron leer los proyectos." }, 500);
    if (informes.length === 0) return json({ omitido: "No hay proyectos activos." });

    const [{ data: perfiles }, { data: miembros }] = await Promise.all([
      supabase.from("perfiles").select("id, nombre, correo, rol_global"),
      supabase.from("miembros_proyecto").select("proyecto_id, usuario_id, rol"),
    ]);
    const destinatarios = repartirInformes(informes.map((i) => i.proyecto.id), (perfiles ?? []) as PerfilEnvio[], (miembros ?? []) as MiembroEnvio[], usuarioAlertas);
    if (destinatarios.length === 0) return json({ omitido: "Ninguna persona tiene proyectos activos asignados y correo registrado.", proyectos: informes.length });

    // Cada archivo se genera una sola vez y se reutiliza para todas las personas.
    const hoy = hoyColombia();
    const archivos = new Map<string, { pdf: Adjunto; xlsx: Adjunto }>();
    for (const i of informes) {
      const base = `informe-gerencial-${i.proyecto.codigo ?? "proyecto"}-${hoy}`;
      archivos.set(i.proyecto.id, {
        pdf: { nombre: nombreArchivo(base, "pdf"), contenido: await informeAPdf(i), tipo: TIPO_PDF },
        xlsx: { nombre: nombreArchivo(base, "xlsx"), contenido: new Uint8Array(await informeAExcel(i)), tipo: TIPO_XLSX },
      });
    }

    const base = urlBase();
    let enviados = 0;
    const errores: string[] = [];
    for (const d of destinatarios) {
      const suyos = informes.filter((i) => d.proyectoIds.includes(i.proyecto.id));
      const c = componerInformeSemanal({ nombre: d.nombre }, suyos, base, hoy);
      const adjuntos = suyos.flatMap((i) => { const a = archivos.get(i.proyecto.id)!; return c.conExcel ? [a.pdf, a.xlsx] : [a.pdf]; });
      const r = await enviarCorreo({ para: d.correo, asunto: c.asunto, texto: c.texto, html: c.html, adjuntos });
      if (r.ok) enviados++;
      else errores.push(r.error ?? "error");
    }
    for (const e of errores) console.error("Informe semanal: fallo al enviar un correo:", e);
    return json({ proyectos: informes.length, destinatarios: destinatarios.length, enviados, fallidos: errores.length, proveedor });
  } finally {
    await supabase.auth.signOut().catch(() => {});
  }
}
