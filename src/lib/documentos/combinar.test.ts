import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { POR_COMPLETAR, camposDeDocx, combinarDocx } from "./combinar";
import { INCORPORADAS, generarPlantillaIncorporada } from "./incorporadas";

// Un .docx mínimo con campos MERGEFIELD simples, uno con formato (negrilla), uno repetido y uno en el encabezado.
async function plantilla(extra: { cuerpo?: string; encabezado?: string } = {}): Promise<Buffer> {
  const zip = new JSZip();
  const campo = (n: string, rpr = "") => `<w:fldSimple w:instr=" MERGEFIELD ${n} \\* MERGEFORMAT "><w:r>${rpr}<w:t>«${n}»</w:t></w:r></w:fldSimple>`;
  zip.file("word/document.xml", `<w:document xmlns:w="x"><w:body><w:p><w:r><w:t>Contratista: </w:t></w:r>${campo("CONTRATISTA", "<w:rPr><w:b/></w:rPr>")}</w:p><w:p>${campo("OBJETO")} y ${campo("OBJETO")}</w:p><w:p>${campo("VACIO")}</w:p>${extra.cuerpo ?? ""}</w:body></w:document>`);
  zip.file("word/header1.xml", `<w:hdr xmlns:w="x"><w:p>${campo("PROYECTO")}${extra.encabezado ?? ""}</w:p></w:hdr>`);
  return zip.generateAsync({ type: "nodebuffer" });
}
const texto = async (b: Buffer, parte = "word/document.xml") => (await (await JSZip.loadAsync(b)).file(parte)!.async("string"));

describe("combinarDocx", () => {
  it("reemplaza los campos del cuerpo y del encabezado, conserva el formato y repite los repetidos", async () => {
    const r = await combinarDocx(await plantilla(), { CONTRATISTA: "Constructora Ejemplo", OBJETO: "Obra civil", PROYECTO: "Bodega norte" });
    const x = await texto(r.archivo);
    expect(x).toContain("<w:rPr><w:b/></w:rPr><w:t xml:space=\"preserve\">Constructora Ejemplo</w:t>");
    expect((x.match(/Obra civil/g) ?? []).length).toBe(2);
    expect(await texto(r.archivo, "word/header1.xml")).toContain("Bodega norte");
    expect(x).not.toContain("MERGEFIELD");
  });
  it("un dato faltante se imprime «[POR COMPLETAR]» y se informa", async () => {
    const r = await combinarDocx(await plantilla(), { CONTRATISTA: "X", OBJETO: "Y", PROYECTO: "Z", VACIO: "   " });
    expect(await texto(r.archivo)).toContain(POR_COMPLETAR);
    expect(r.faltantes).toEqual(["VACIO"]);
  });
  it("escapa el XML y pasa los saltos de línea a saltos de Word", async () => {
    const r = await combinarDocx(await plantilla(), { CONTRATISTA: "A & B <S.A.S.>", OBJETO: "línea 1\nlínea 2", PROYECTO: "P" });
    const x = await texto(r.archivo);
    expect(x).toContain("A &amp; B &lt;S.A.S.&gt;");
    expect(x).toContain("línea 1</w:t><w:br/><w:t xml:space=\"preserve\">línea 2");
  });
  it("lista los campos y avisa de los que no soporta", async () => {
    const p = await plantilla({ cuerpo: '<w:p><w:r><w:instrText> MERGEFIELD COMPLEJO </w:instrText></w:r></w:p>' });
    const c = await camposDeDocx(p);
    expect(c.campos).toEqual(["CONTRATISTA", "OBJETO", "VACIO", "PROYECTO"]);
    expect(c.noSoportados).toBe(1);
  });
  it("rechaza lo que no es un Word", async () => {
    const zip = new JSZip(); zip.file("hola.txt", "hola");
    await expect(combinarDocx(await zip.generateAsync({ type: "nodebuffer" }), {})).rejects.toThrow(/no es un documento de Word/);
    await expect(combinarDocx(Buffer.from("no es un zip"), {})).rejects.toThrow();
    await expect(combinarDocx(Buffer.alloc(9 * 1024 * 1024), {})).rejects.toThrow(/demasiado grande/);
  });
  it("las plantillas incorporadas se generan, traen sus campos y se combinan", async () => {
    for (const p of INCORPORADAS) {
      const buf = await generarPlantillaIncorporada(p);
      const { campos, noSoportados } = await camposDeDocx(buf);
      expect(noSoportados).toBe(0);
      expect(campos.sort()).toEqual([...p.campos].sort());
      const r = await combinarDocx(buf, {});
      expect(r.faltantes.sort()).toEqual([...p.campos].sort());
    }
  });
});
