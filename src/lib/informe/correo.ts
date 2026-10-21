// Cuerpo del correo del informe semanal: resumen con los puntos principales e invitación a abrir los archivos adjuntos.
import { LEMA_PLATAFORMA, NOMBRE_PLATAFORMA } from "../marca";
import { ETIQUETA_NIVEL, pesosCorto, puntosPrincipales, resumenPortafolio, type InformeProyecto } from "./modelo";
import type { CorreoArmado } from "../alertas/resumen";
import { semanaIso } from "../pmo/formato";

// Con muchos proyectos el correo se acorta: menos puntos por proyecto y solo PDF adjunto.
export const MAX_PROYECTOS_CON_EXCEL = 6;
export const HORA_ENVIO = "los lunes a las 7:30 a. m. (hora de Colombia)";

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// Estados con la paleta de alertas del sistema de diseño GreenLand v1.0.0 (texto y contorno del mismo color).
const COLOR = { verde: { fondo: "#e6f0e6", texto: "#027001", n: "Verde" }, amarillo: { fondo: "#fbefd9", texto: "#9a5b00", n: "Amarillo" }, rojo: { fondo: "#f8e6e4", texto: "#a32a1f", n: "Rojo" }, nulo: { fondo: "#f2f2f2", texto: "#5e5e5e", n: "Sin datos" } };
const color = (i: InformeProyecto) => COLOR[i.semaforo.general ?? "nulo"];

const FECHA_LARGA = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
export const fechaLarga = (iso: string) => FECHA_LARGA.format(new Date(`${iso}T12:00:00Z`));

export function componerInformeSemanal(
  persona: { nombre: string },
  informes: InformeProyecto[],
  urlBase: string,
  fecha: string,
): CorreoArmado & { conExcel: boolean } {
  const r = resumenPortafolio(informes);
  const semana = semanaIso(fecha).semana;
  const conExcel = informes.length <= MAX_PROYECTOS_CON_EXCEL;
  const puntosPor = informes.length > 3 ? 2 : 3;
  const uno = informes.length === 1;
  const asunto = `[${NOMBRE_PLATAFORMA}] Informe gerencial semanal${uno ? ` — ${informes[0].proyecto.nombre}` : ""} · semana ${semana}`;
  const resumenLinea = uno
    ? `Estado general del proyecto: ${color(informes[0]).n}.`
    : `${r.total} proyectos activos: ${r.verdes} en verde, ${r.amarillos} en amarillo, ${r.rojos} en rojo${r.sinDatos ? ` y ${r.sinDatos} sin datos` : ""}.`;
  const adjuntoTexto = conExcel ? "el archivo adjunto de cada proyecto (PDF y Excel)" : "el PDF adjunto de cada proyecto";
  const puntos = (i: InformeProyecto) => puntosPrincipales(i).slice(0, puntosPor);
  const nombre = (i: InformeProyecto) => `${i.proyecto.codigo ? `${i.proyecto.codigo} · ` : ""}${i.proyecto.nombre}`;
  const decisionesTotal = informes.reduce((a, i) => a + i.decisiones.length, 0);

  const texto = [
    `Hola ${persona.nombre},`,
    "",
    `Este es el informe gerencial de la semana ${semana} (${fechaLarga(fecha)}). ${resumenLinea}${decisionesTotal ? ` Hay ${decisionesTotal} decisión(es) pendiente(s) de la dirección.` : ""}`,
    "",
    "PUNTOS PRINCIPALES",
    ...informes.flatMap((i) => ["", `${nombre(i).toUpperCase()} — ${color(i).n}`, ...puntos(i).map((t) => `- ${t}`)]),
    "",
    `Para ver el detalle completo (riesgos principales, decisiones, hitos, cambios y último reporte), abre ${adjuntoTexto}.`,
    `También puedes entrar a ${urlBase}.`,
    "",
    `Este correo se envía automáticamente ${HORA_ENVIO}.`,
  ].join("\n");

  const bloque = (i: InformeProyecto) => {
    const c = color(i);
    const crit = i.riesgos.principales.filter((x) => x.nivel === "critico").slice(0, 2);
    return `<div style="border:1.5px solid #e4e4e4;border-radius:20px;margin:14px 0;overflow:hidden">
<div style="border-bottom:1.5px solid #e4e4e4;padding:10px 16px"><span style="color:#027001;font-size:16px">${esc(nombre(i))}</span><span style="float:right;border:1.5px solid ${c.texto};color:${c.texto};border-radius:999px;padding:1px 10px;font-size:12px">${c.n}</span></div>
<div style="padding:8px 14px 10px"><ul style="padding-left:18px;margin:6px 0">${puntos(i).map((t) => `<li style="margin:4px 0">${esc(t)}</li>`).join("")}</ul>${crit.length ? `<p style="margin:6px 0 0;font-size:12px;color:#5e5e5e">${ETIQUETA_NIVEL.critico}: ${crit.map((x) => esc(`${x.codigo} ${x.descripcion.length > 70 ? `${x.descripcion.slice(0, 69)}…` : x.descripcion}`)).join(" · ")}</p>` : ""}${i.bac !== null ? `<p style="margin:6px 0 0;font-size:12px;color:#5e5e5e">Presupuesto ${esc(pesosCorto(i.bac))} · SPI ${i.spi === null ? "—" : i.spi.toLocaleString("es-CO", { minimumFractionDigits: 2 })} · CPI ${i.cpi === null ? "—" : i.cpi.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</p>` : ""}</div></div>`;
  };
  const html = `<div style="font-family:Archivo,'Helvetica Neue',Helvetica,Arial,sans-serif;color:#5e5e5e;max-width:640px;line-height:1.45">
<h2 style="color:#027001;font-weight:300;margin:0 0 2px">Informe gerencial semanal</h2>
<p style="margin:0 0 14px;color:#5e5e5e;font-size:13px">${esc(NOMBRE_PLATAFORMA)} · ${esc(LEMA_PLATAFORMA)} · Semana ${semana} · ${esc(fechaLarga(fecha))}</p>
<p>Hola ${esc(persona.nombre)},</p>
<p>${esc(resumenLinea)}${decisionesTotal ? ` Hay <strong>${decisionesTotal} decisión(es) pendiente(s)</strong> de la dirección.` : ""} Estos son los puntos principales:</p>
${informes.map(bloque).join("")}
<p style="border:1.5px solid #027001;padding:10px 18px;border-radius:20px">Para ver el <strong>detalle completo</strong> (riesgos principales, decisiones, hitos, cambios y último reporte), abre ${esc(adjuntoTexto)}.</p>
<p style="margin-top:18px"><a href="${esc(urlBase)}" style="background:#027001;color:#fff;padding:10px 26px;border-radius:999px;text-decoration:none">Abrir ${esc(NOMBRE_PLATAFORMA)}</a></p>
<p style="font-size:12px;color:#5e5e5e;margin-top:18px">Este correo se envía automáticamente ${esc(HORA_ENVIO)}.</p></div>`;
  return { asunto, texto, html, conExcel };
}
