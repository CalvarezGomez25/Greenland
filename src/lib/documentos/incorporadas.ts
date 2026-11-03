// Plantillas incorporadas: dos borradores de EJEMPLO con texto neutro, para poder generar documentos sin haber subido las plantillas
// jurídicas de la empresa. Llevan la leyenda de que requieren revisión jurídica. Las plantillas oficiales las sube el administrador.

import JSZip from "jszip";

export type PlantillaIncorporada = { id: string; nombre: string; ambito: "contrato" | "modificacion"; titulo: string; parrafos: string[]; campos: string[] };

const campo = (n: string) => `«${n}»`;
export const INCORPORADAS: PlantillaIncorporada[] = [
  {
    id: "incorporada:acta_inicio", nombre: "Acta de inicio (borrador de ejemplo)", ambito: "contrato", titulo: "ACTA DE INICIO",
    parrafos: [
      "BORRADOR DE EJEMPLO: este texto es neutro y requiere revisión jurídica antes de usarse.",
      `Proyecto: ${campo("PROYECTO")}. Lugar de ejecución: ${campo("LUGAR_EJECUCION")}.`,
      `Contratante: ${campo("CONTRATANTE")}, NIT ${campo("CONTRATANTE_NIT")}, representada por ${campo("CONTRATANTE_RL")}.`,
      `Contratista: ${campo("CONTRATISTA")}, NIT ${campo("CONTRATISTA_NIT")}, representado por ${campo("CONTRATISTA_RL")}.`,
      `Contrato (${campo("TIPO_DOCUMENTO")}) N.° ${campo("CONSECUTIVO")}, firmado el ${campo("FIRMA_DIA")} de ${campo("FIRMA_MES")} de ${campo("FIRMA_ANIO")}.`,
      `Objeto: ${campo("OBJETO")}`,
      `Valor del contrato: ${campo("VALOR_NUMERO")} (${campo("VALOR_LETRAS")}).`,
      `Plazo de ejecución: ${campo("PLAZO")}. Fecha del acta de inicio: ${campo("ACTA_INICIO")}. Fecha de terminación prevista: ${campo("FECHA_FIN_VIGENTE")}.`,
      `Interventor: ${campo("INTERVENTOR")}.`,
      "Las partes dejan constancia de que, con esta acta, inicia la ejecución del contrato.",
      "Firmas: ______________________   ______________________   ______________________",
    ],
    campos: ["PROYECTO", "LUGAR_EJECUCION", "CONTRATANTE", "CONTRATANTE_NIT", "CONTRATANTE_RL", "CONTRATISTA", "CONTRATISTA_NIT", "CONTRATISTA_RL", "TIPO_DOCUMENTO", "CONSECUTIVO", "FIRMA_DIA", "FIRMA_MES", "FIRMA_ANIO", "OBJETO", "VALOR_NUMERO", "VALOR_LETRAS", "PLAZO", "ACTA_INICIO", "FECHA_FIN_VIGENTE", "INTERVENTOR"],
  },
  {
    id: "incorporada:constancia_modificacion", nombre: "Constancia de modificación (borrador de ejemplo)", ambito: "modificacion", titulo: "CONSTANCIA DE MODIFICACIÓN CONTRACTUAL",
    parrafos: [
      "BORRADOR DE EJEMPLO: este texto es neutro y requiere revisión jurídica antes de usarse.",
      `${campo("MOD_TIPO_MAY")} N.° ${campo("MOD_NUMERO")} al contrato N.° ${campo("CONSECUTIVO")} del proyecto ${campo("PROYECTO")}.`,
      `Contratante: ${campo("CONTRATANTE")}, NIT ${campo("CONTRATANTE_NIT")}. Contratista: ${campo("CONTRATISTA")}, NIT ${campo("CONTRATISTA_NIT")}.`,
      `Objeto del contrato: ${campo("OBJETO")}`,
      `Antecedentes: ${campo("ANTECEDENTES")}`,
      `Objeto de ${campo("MOD_REF")}: ${campo("MOD_OBJETO")}`,
      `Justificación: ${campo("MOD_JUSTIFICACION")}`,
      `Valor: ${campo("MOD_PRECIO")}`,
      `Plazo: ${campo("MOD_VIGENCIA")}`,
      `Firmada el ${campo("FIRMA_DIA")} de ${campo("FIRMA_MES")} de ${campo("FIRMA_ANIO")}.`,
      "Firmas: ______________________   ______________________",
    ],
    campos: ["MOD_TIPO_MAY", "MOD_NUMERO", "CONSECUTIVO", "PROYECTO", "CONTRATANTE", "CONTRATANTE_NIT", "CONTRATISTA", "CONTRATISTA_NIT", "OBJETO", "ANTECEDENTES", "MOD_REF", "MOD_OBJETO", "MOD_JUSTIFICACION", "MOD_PRECIO", "MOD_VIGENCIA", "FIRMA_DIA", "FIRMA_MES", "FIRMA_ANIO"],
  },
];

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Convierte «CAMPO» en un campo de combinación de Word (MERGEFIELD) dentro de un párrafo.
function parrafo(texto: string, opciones: { negrilla?: boolean; centrado?: boolean } = {}): string {
  const rpr = opciones.negrilla ? "<w:rPr><w:b/></w:rPr>" : "";
  const ppr = opciones.centrado ? '<w:pPr><w:jc w:val="center"/></w:pPr>' : "";
  const partes = texto.split(/(«[A-Z0-9_]+»)/).filter(Boolean).map((p) => {
    const m = /^«([A-Z0-9_]+)»$/.exec(p);
    return m
      ? `<w:fldSimple w:instr=" MERGEFIELD ${m[1]} "><w:r>${rpr}<w:t xml:space="preserve">«${m[1]}»</w:t></w:r></w:fldSimple>`
      : `<w:r>${rpr}<w:t xml:space="preserve">${esc(p)}</w:t></w:r>`;
  });
  return `<w:p>${ppr}${partes.join("")}</w:p>`;
}

export async function generarPlantillaIncorporada(p: PlantillaIncorporada): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file("_rels/.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  const cuerpo = [parrafo(p.titulo, { negrilla: true, centrado: true }), ...p.parrafos.map((t) => parrafo(t))].join("");
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${cuerpo}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1417" w:right="1417" w:bottom="1417" w:left="1417" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
