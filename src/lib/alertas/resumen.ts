// Reparte las decisiones pendientes entre las personas responsables y arma el texto del correo.
// Son funciones puras (sin red ni base de datos) para poder probarlas.
import type { Decision } from "../pmo/portafolio";
import { NOMBRE_PLATAFORMA } from "../marca";

export type Persona = { id: string; nombre: string; correo: string };
export type ResumenPersona = { persona: Persona; decisiones: Decision[] };

// Director: lo que corresponde al director (o a ambos) de todos los proyectos.
// Gerente: lo que corresponde al gerente (o a ambos) de SUS proyectos.
// Si no hay director registrado, esas decisiones van a los administradores.
export function repartirDecisiones(
  decisiones: Decision[],
  directores: Persona[],
  gerentesPorProyecto: Map<string, Persona[]>,
): ResumenPersona[] {
  const por = new Map<string, ResumenPersona>();
  const dar = (p: Persona, d: Decision) => {
    if (!p.correo) return;
    const r = por.get(p.id) ?? { persona: p, decisiones: [] };
    if (!r.decisiones.includes(d)) r.decisiones.push(d);
    por.set(p.id, r);
  };
  for (const d of decisiones) {
    if (d.audiencia === "director" || d.audiencia === "ambos") directores.forEach((p) => dar(p, d));
    if (d.audiencia === "gerente" || d.audiencia === "ambos") (gerentesPorProyecto.get(d.proyectoId) ?? []).forEach((p) => dar(p, d));
  }
  return [...por.values()];
}

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export type CorreoArmado = { asunto: string; texto: string; html: string };

function agruparPorProyecto(ds: Decision[]): [string, Decision[]][] {
  const m = new Map<string, Decision[]>();
  for (const d of ds) m.set(d.proyecto, [...(m.get(d.proyecto) ?? []), d]);
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "es"));
}

// Resumen diario de decisiones pendientes de una persona.
export function componerResumen(r: ResumenPersona, urlBase: string, fecha: string): CorreoArmado {
  const n = r.decisiones.length;
  const asunto = `[${NOMBRE_PLATAFORMA}] ${n === 1 ? "Tienes 1 decisión pendiente" : `Tienes ${n} decisiones pendientes`}`;
  const grupos = agruparPorProyecto(r.decisiones);
  const enlace = (d: Decision) => `${urlBase}${d.href}`;
  const texto = [
    `Hola ${r.persona.nombre},`,
    "",
    `Estas son las decisiones que esperan tu atención (${fecha}):`,
    "",
    ...grupos.flatMap(([proyecto, ds]) => [proyecto.toUpperCase(), ...ds.map((d) => `- ${d.tipo}: ${d.detalle}\n  ${enlace(d)}`), ""]),
    `Entra a ${urlBase} para revisarlas. Este correo se envía cada día mientras haya decisiones pendientes.`,
  ].join("\n");
  const html = `<div style="font-family:Archivo,'Helvetica Neue',Helvetica,Arial,sans-serif;color:#5e5e5e;max-width:620px">
<p>Hola ${esc(r.persona.nombre)},</p>
<p>Estas son las decisiones que esperan tu atención (${esc(fecha)}):</p>
${grupos.map(([proyecto, ds]) => `<h3 style="margin:18px 0 6px;color:#027001">${esc(proyecto)}</h3><ul style="padding-left:18px;margin:0">${ds.map((d) => `<li style="margin:6px 0"><strong>${esc(d.tipo)}</strong>: ${esc(d.detalle)} — <a href="${esc(enlace(d))}" style="color:#027001">abrir</a></li>`).join("")}</ul>`).join("")}
<p style="margin-top:20px"><a href="${esc(urlBase)}" style="background:#027001;color:#fff;padding:10px 26px;border-radius:999px;text-decoration:none">Abrir ${esc(NOMBRE_PLATAFORMA)}</a></p>
<p style="font-size:12px;color:#5e5e5e">Este correo se envía cada día mientras haya decisiones pendientes.</p></div>`;
  return { asunto, texto, html };
}

// Aviso inmediato de una sola decisión.
export function componerAviso(p: { titulo: string; detalle: string; proyecto: string; href: string }, urlBase: string): CorreoArmado {
  const url = `${urlBase}${p.href}`;
  const asunto = `[${NOMBRE_PLATAFORMA}] ${p.titulo} — ${p.proyecto}`;
  const texto = `${p.titulo}\nProyecto: ${p.proyecto}\n\n${p.detalle}\n\nRevísalo aquí: ${url}`;
  const html = `<div style="font-family:Archivo,'Helvetica Neue',Helvetica,Arial,sans-serif;color:#5e5e5e;max-width:620px">
<h2 style="color:#027001;margin:0 0 6px">${esc(p.titulo)}</h2><p style="margin:0 0 12px;color:#5e5e5e">Proyecto: ${esc(p.proyecto)}</p>
<p>${esc(p.detalle).replace(/\n/g, "<br>")}</p>
<p style="margin-top:18px"><a href="${esc(url)}" style="background:#027001;color:#fff;padding:10px 26px;border-radius:999px;text-decoration:none">Revisar y decidir</a></p></div>`;
  return { asunto, texto, html };
}
