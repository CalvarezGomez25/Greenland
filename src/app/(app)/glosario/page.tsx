import Link from "next/link";
import { Titulo } from "@/components/ui";
import { CATEGORIAS_GLOSARIO, GLOSARIO } from "@/lib/glosario";
import { GUIAS } from "@/lib/guias";
import { GlosarioBuscable } from "./glosario-buscable";

export const metadata = { title: "Ayuda · PMO360" };

export default function PaginaGlosario() {
  const terminos = CATEGORIAS_GLOSARIO.flatMap((c) => c.temas.map((t) => ({ categoria: c.titulo, ...GLOSARIO[t] })));
  return (
    <>
      <Titulo>Ayuda: glosario y guías</Titulo>
      <p className="mt-3 max-w-3xl text-sm text-muted">
        Qué significa cada sigla e indicador y cómo diligenciar los datos de cada módulo. En las pantallas también encuentras estas explicaciones en los íconos «?».
      </p>
      <p className="mt-2 max-w-3xl text-sm text-muted">¿Por qué se llama PMO360 y qué es FARO? <Link href="/faro" className="font-medium text-leaf-600 hover:underline">Acerca de FARO →</Link></p>
      <GlosarioBuscable terminos={terminos} guias={GUIAS} />
    </>
  );
}
