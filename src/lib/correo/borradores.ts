// Borradores de correo que se abren en el programa de correo de la persona (enlace «mailto:»). La plataforma no envía nada:
// la persona revisa el mensaje y lo manda desde su cuenta. Las invitaciones a varios oferentes van en copia oculta (Cco)
// para que los competidores no vean los correos de los demás.

export type Borrador = { para?: string[]; cco?: string[]; asunto: string; cuerpo: string };

const CORREO = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;
export const MAX_CUERPO = 1500; // algunos programas de correo recortan enlaces muy largos

export const correosValidos = (l: (string | null | undefined)[]): string[] => [...new Set(l.map((c) => (c ?? "").trim()).filter((c) => CORREO.test(c)))];

export function enlaceCorreo(b: Borrador): string | null {
  const para = correosValidos(b.para ?? []), cco = correosValidos(b.cco ?? []);
  if (para.length === 0 && cco.length === 0) return null;
  const cuerpo = b.cuerpo.length > MAX_CUERPO ? `${b.cuerpo.slice(0, MAX_CUERPO - 1)}…` : b.cuerpo;
  const params = [`subject=${encodeURIComponent(b.asunto)}`, `body=${encodeURIComponent(cuerpo.replace(/\n/g, "\r\n"))}`];
  if (cco.length) params.unshift(`bcc=${cco.map(encodeURIComponent).join(",")}`);
  return `mailto:${para.map(encodeURIComponent).join(",")}?${params.join("&")}`;
}

const fecha = (f: string) => {
  const [a, m, d] = f.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
};

// Invitación a ofertar. No incluye el presupuesto de referencia: es información interna.
export function invitacionProceso(p: { codigo: string; objeto: string; cierre: string | null; proyecto: string; enlaceCarpeta?: string | null }): Pick<Borrador, "asunto" | "cuerpo"> {
  const L = ["Buen día,", "", `Los invitamos a presentar oferta para el proceso ${p.codigo} del proyecto ${p.proyecto}.`, "", `Objeto: ${p.objeto}`];
  if (p.cierre) L.push(`Cierre de propuestas: ${fecha(p.cierre)}`);
  if (p.enlaceCarpeta) L.push(`Documentos del proceso: ${p.enlaceCarpeta}`);
  L.push("", "Por favor confirmen el recibo de este mensaje y envíen su oferta por este mismo medio antes de la fecha de cierre.", "", "Cordialmente,");
  return { asunto: `Invitación a ofertar · ${p.codigo} · ${p.proyecto}`, cuerpo: L.join("\n") };
}

export function recordatorioPoliza(p: { amparo: string; vence: string; contratista: string; proyecto: string; vencida: boolean }): Pick<Borrador, "asunto" | "cuerpo"> {
  const estado = p.vencida ? `venció el ${fecha(p.vence)}` : `vence el ${fecha(p.vence)}`;
  return {
    asunto: `${p.vencida ? "Póliza vencida" : "Póliza por vencer"} · ${p.amparo} · ${p.proyecto}`,
    cuerpo: ["Buen día,", "", `La póliza de ${p.amparo} del contrato de ${p.contratista} en el proyecto ${p.proyecto} ${estado}.`, "", "Por favor envíen la renovación o el certificado vigente para actualizar el registro.", "", "Cordialmente,"].join("\n"),
  };
}

export function recordatorioCompromiso(p: { asunto: string; fecha: string; contratista: string; proyecto: string }): Pick<Borrador, "asunto" | "cuerpo"> {
  return {
    asunto: `Recordatorio de compromiso · ${p.asunto}`,
    cuerpo: ["Buen día,", "", `Les recordamos el compromiso «${p.asunto}» del contrato de ${p.contratista} en el proyecto ${p.proyecto}, con fecha ${fecha(p.fecha)}.`, "", "Quedamos atentos a su confirmación.", "", "Cordialmente,"].join("\n"),
  };
}
