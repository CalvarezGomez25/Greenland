import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/sesion";
import { formatearFecha } from "@/lib/formato";
import { construirCampos } from "@/lib/documentos/campos";
import { INCORPORADAS } from "@/lib/documentos/incorporadas";
import { BotonEnviar } from "@/components/boton-enviar";
import { Titulo } from "@/components/ui";
import { borrarPlantilla, cambiarEstadoPlantilla } from "./acciones";
import { FormularioSubidaPlantilla } from "./formulario-subida";
import { Ayuda } from "@/components/ayuda";

// Campos que PMO360 sabe llenar con los datos de un contrato y una modificación (el resto se escribe al generar el documento).
const RESUELTOS = (() => {
  const base = { hoy: "2026-01-01", proyecto: { nombre: "x", ubicacion: "x" }, contrato: { tipo: "obra", objeto: "x", valor: 1n, consecutivo: "x", fechaFirma: "2026-01-01", fechaActaInicio: "2026-01-01", fechaFinVigente: "2026-01-01", plazoValor: 1, plazoUnidad: "meses", contratista: "x", ordenServicio: null },
    tercero: { razonSocial: "x", nit: "1", municipio: "x", direccion: "x", correo: "x", representante: "x" }, contratante: { razonSocial: "x", nit: "1", municipio: "x", correo: "x", correoFacturacion: "x", representante: "x" }, actas: [],
    modificaciones: [{ id: "m", tipo: "adicion", numero: 1, fechaFirma: "2026-01-01", nuevaFechaFin: null, valor: 0n, descripcion: "x", justificacion: "x", estado: "firmada" }], modificacionId: "m",
    parametros: ["penal_pct", "multa_dia_pct", "confid_smmlv", "confid_anios", "liquidacion_meses", "aviso_terminacion_dias", "inicio_dias", "suspension_dias", "subsanar_dias"].map((k) => ({ ambito: "global", ambito_id: null, clave: `minuta_${k}`, valor: "1" })) };
  return new Set(Object.keys(construirCampos(base)));
})();

async function Contenido() {
  const { supabase } = await obtenerSesion();
  const { data: puedeVer } = await supabase.rpc("puede_ver_aliados");
  if (puedeVer !== true) redirect("/");
  const { data: puedeEditar } = await supabase.rpc("puede_editar_contratantes");
  const { data } = await supabase.from("plantillas_documento").select("id, nombre, ambito, campos, activa, nota, tamano, creado_en").order("creado_en", { ascending: false });
  const lista = (data ?? []) as { id: string; nombre: string; ambito: string; campos: string[]; activa: boolean; nota: string | null; tamano: number; creado_en: string }[];
  return (
    <>
      <Link href="/aliados" className="text-sm font-medium text-leaf-600 hover:underline">← Volver a RAIZ</Link>
      <div className="mt-4"><span className="inline-flex items-center gap-2"><Titulo>Plantillas de documentos</Titulo><Ayuda tema="plantilla_documento" /></span></div>
      <p className="mt-3 max-w-3xl text-sm text-muted">
        Archivos Word con campos de combinación (MERGEFIELD) con los nombres de RAÍZ. El texto jurídico vive en estos archivos, no en la plataforma: Jurídica los revisa y el administrador los sube.
        Con ellos se generan minutas, otrosíes y actas desde cada contrato. Los textos del kit de formatos y de la multa del 3 % del paquete requieren revisión jurídica antes de uso general.
      </p>
      <section className="mt-6" aria-labelledby="t-lista">
        <h2 id="t-lista" className="font-display text-2xl font-bold text-leaf-700">Plantillas de la empresa</h2>
        {lista.length === 0 ? <p className="mt-3 rounded-card bg-leaf-50 p-5 text-sm text-muted">Aún no hay plantillas subidas. Mientras tanto se pueden usar las {INCORPORADAS.length} plantillas incorporadas de ejemplo.</p> : (
          <div className="mt-3 overflow-x-auto rounded-card border border-soil-border">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-leaf-100 text-xs uppercase tracking-wider text-leaf-800"><tr>{["Plantilla", "Se usa para", "Campos", "Estado", ""].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-soil-border">
                {lista.map((p) => {
                  const sin = p.campos.filter((c) => !RESUELTOS.has(c));
                  return (
                    <tr key={p.id} className={p.activa ? "" : "text-muted"}>
                      <td className="px-3 py-2 align-top font-medium">{p.nombre}<p className="text-xs font-normal text-muted">{formatearFecha(p.creado_en.slice(0, 10))} · {(p.tamano / 1024).toFixed(0)} KB{p.nota ? ` · ${p.nota}` : ""}</p></td>
                      <td className="px-3 py-2 align-top">{p.ambito === "contrato" ? "Contrato" : "Modificación"}</td>
                      <td className="px-3 py-2 align-top">{p.campos.length} en total<p className="text-xs text-muted">{sin.length === 0 ? "PMO360 los llena todos" : `${sin.length} por escribir al generar: ${sin.slice(0, 8).join(", ")}${sin.length > 8 ? "…" : ""}`}</p></td>
                      <td className="px-3 py-2 align-top">{p.activa ? "Activa" : "Desactivada"}</td>
                      <td className="px-3 py-2 text-right align-top">
                        {puedeEditar === true && (
                          <div className="flex flex-wrap justify-end gap-3">
                            <form action={cambiarEstadoPlantilla.bind(null, p.id, !p.activa)}><BotonEnviar className="text-sm font-medium text-leaf-600 underline" textoEnviando="…">{p.activa ? "Desactivar" : "Activar"}</BotonEnviar></form>
                            <form action={borrarPlantilla.bind(null, p.id)}><BotonEnviar className="text-sm font-medium text-danger underline" textoEnviando="…">Borrar</BotonEnviar></form>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="mt-8" aria-labelledby="t-inc">
        <h2 id="t-inc" className="font-display text-2xl font-bold text-leaf-700">Plantillas incorporadas (ejemplo)</h2>
        <ul className="mt-3 list-disc pl-5 text-sm">{INCORPORADAS.map((p) => <li key={p.id}>{p.nombre}: {p.ambito === "contrato" ? "contrato" : "modificación"}, {p.campos.length} campos. Texto neutro; requiere revisión jurídica.</li>)}</ul>
      </section>
      {puedeEditar === true ? (
        <section className="mt-8" aria-labelledby="t-subir"><h2 id="t-subir" className="font-display text-2xl font-bold text-leaf-700">Subir una plantilla <Ayuda tema="campos_combinacion" /></h2><div className="mt-3 rounded-card bg-leaf-50 p-5"><FormularioSubidaPlantilla /></div></section>
      ) : <p className="mt-6 text-sm text-muted">Solo el administrador y el director general suben plantillas.</p>}
    </>
  );
}

export default function PaginaPlantillas() {
  return <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><Contenido /></Suspense>;
}
