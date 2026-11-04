// Archivo de calendario (.ics, RFC 5545) y enlaces para agregar un evento a Google Calendar u Outlook.
// Son eventos de día completo; no se envía nada a ningún servicio: la persona descarga el archivo o abre el enlace.

export type EventoCal = {
  uid: string; // estable: al reimportar el archivo, el calendario actualiza el evento en vez de duplicarlo
  titulo: string;
  fecha: string; // AAAA-MM-DD
  descripcion?: string;
  categoria?: string;
  url?: string;
};

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
export const fechaValida = (f: string): boolean => FECHA.test(f) && !Number.isNaN(Date.parse(`${f}T00:00:00Z`)) && new Date(`${f}T00:00:00Z`).toISOString().slice(0, 10) === f;

export function diaSiguiente(f: string): string {
  const d = new Date(`${f}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
const compacta = (f: string) => f.replaceAll("-", "");

// Texto de una propiedad: se escapan la barra, el punto y coma, la coma y los saltos de línea.
export function escaparTexto(s: string): string {
  return s.replaceAll("\\", "\\\\").replaceAll(";", "\;").replaceAll(",", "\\,").replace(/\r\n|\r|\n/g, "\\n");
}

// Una línea no pasa de 75 bytes; las siguientes empiezan con un espacio. No se parte un carácter de varios bytes.
export function plegar(linea: string): string {
  const enc = new TextEncoder();
  if (enc.encode(linea).length <= 75) return linea;
  const partes: string[] = [];
  let actual = "";
  let bytes = 0;
  let limite = 75;
  for (const ch of linea) {
    const n = enc.encode(ch).length;
    if (bytes + n > limite) {
      partes.push(actual);
      actual = ch;
      bytes = n;
      limite = 74; // el espacio inicial de la continuación cuenta
    } else {
      actual += ch;
      bytes += n;
    }
  }
  partes.push(actual);
  return partes.join("\r\n ");
}

const sello = (ahora: Date) => ahora.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

export function construirICS(eventos: EventoCal[], ahora: Date = new Date(), nombre = "PMO360"): string {
  const L: string[] = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//GreenLand//PMO360//ES", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${escaparTexto(nombre)}`];
  for (const e of eventos) {
    if (!fechaValida(e.fecha)) continue;
    L.push("BEGIN:VEVENT", `UID:${e.uid.replace(/[^A-Za-z0-9@._-]/g, "-")}@pmo360`, `DTSTAMP:${sello(ahora)}`);
    L.push(`DTSTART;VALUE=DATE:${compacta(e.fecha)}`, `DTEND;VALUE=DATE:${compacta(diaSiguiente(e.fecha))}`);
    L.push(`SUMMARY:${escaparTexto(e.titulo)}`);
    if (e.descripcion) L.push(`DESCRIPTION:${escaparTexto(e.descripcion)}`);
    if (e.categoria) L.push(`CATEGORIES:${escaparTexto(e.categoria)}`);
    if (e.url) L.push(`URL:${e.url}`);
    L.push("TRANSP:TRANSPARENT", "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escaparTexto(e.titulo)}`, "TRIGGER:-P1D", "END:VALARM", "END:VEVENT");
  }
  L.push("END:VCALENDAR");
  return L.map(plegar).join("\r\n") + "\r\n";
}

const q = (o: Record<string, string>) => Object.entries(o).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
const detalle = (e: EventoCal) => [e.descripcion, e.url].filter(Boolean).join("\n");

export function enlaceGoogle(e: EventoCal): string {
  return `https://calendar.google.com/calendar/render?${q({ action: "TEMPLATE", text: e.titulo, dates: `${compacta(e.fecha)}/${compacta(diaSiguiente(e.fecha))}`, details: detalle(e) })}`;
}
export function enlaceOutlook(e: EventoCal): string {
  return `https://outlook.live.com/calendar/0/deeplink/compose?${q({ path: "/calendar/action/compose", rru: "addevent", subject: e.titulo, startdt: e.fecha, enddt: diaSiguiente(e.fecha), allday: "true", body: detalle(e) })}`;
}
