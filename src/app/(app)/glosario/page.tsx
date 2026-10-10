import { Titulo } from "@/components/ui";
import { CATEGORIAS_GLOSARIO, GLOSARIO } from "@/lib/glosario";
import { GUIAS } from "@/lib/guias";
import { GlosarioBuscable } from "./glosario-buscable";

export const metadata = { title: "Glosario y guías · PMO360" };

export default function PaginaGlosario() {
  const terminos = CATEGORIAS_GLOSARIO.flatMap((c) => c.temas.map((t) => ({ categoria: c.titulo, ...GLOSARIO[t] })));
  return (
    <>
      <Titulo>Glosario y guías</Titulo>
      <p className="mt-3 max-w-3xl text-sm text-muted">
        Qué significa cada sigla e indicador y cómo diligenciar los datos de cada módulo. En las pantallas también encuentras estas explicaciones en los íconos «?».
      </p>
      <GlosarioBuscable terminos={terminos} guias={GUIAS} />
    </>
  );
}
